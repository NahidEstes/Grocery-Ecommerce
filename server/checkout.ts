import { createHash, timingSafeEqual } from "node:crypto";
import { cartTotals } from "../src/lib/commerce";
import { isValidDelivery, type OrderRecord } from "../src/lib/orders";
import type { UserRecord } from "./auth";
import { atomic } from "./repository";
import {
  findOrder,
  getCatalog,
  getSettings,
  saveCatalog,
  saveOrder,
  replaceOrder,
  listOrders,
  databaseMode,
} from "./store";
import { orderSchema, bad } from "./validation";
import type { z } from "zod";
import { audit, stockEvent } from "./management-store";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function tokenAccess(order: OrderRecord | null, token: string) {
  if (!order?.accessTokenHash || !token || token.length > 128) return false;
  const actual = Buffer.from(hash(token), "hex"),
    expected = Buffer.from(order.accessTokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function publicOrder(record: OrderRecord) {
  const {
    accessTokenHash: _token,
    fingerprint: _fingerprint,
    paymentUrl: _url,
    gatewayValidationId: _validation,
    ...order
  } = record;
  return order;
}
export const paymentsEnabled = () =>
  (process.env.SSLCOMMERZ_LIVE !== "true" || databaseMode() === "mongodb") &&
  !!(
    process.env.SSLCOMMERZ_STORE_ID &&
    process.env.SSLCOMMERZ_STORE_PASSWORD &&
    process.env.PUBLIC_API_URL &&
    process.env.WEB_ORIGIN?.startsWith("https://")
  );
export async function expirePending() {
  const expired = (await listOrders()).filter(
    (o) =>
      o.payment === "online" &&
      o.paymentStatus === "pending" &&
      o.status === "placed" &&
      Date.parse(o.createdAt) + 30 * 60000 < Date.now(),
  );
  for (const order of expired) await changeStatus(order.reference, "cancelled");
}
export async function placeOrder(
  input: z.infer<typeof orderSchema>,
  user: UserRecord | null,
) {
  return atomic(async () => {
    const reference = `FC-${input.requestId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const fingerprint = hash(
      JSON.stringify({
        ...input,
        requestId: undefined,
        accessToken: undefined,
        userId: user?.id,
      }),
    );
    const existing = await findOrder(reference);
    if (existing) {
      if (
        !tokenAccess(existing, input.accessToken) ||
        existing.fingerprint !== fingerprint
      )
        throw bad("This checkout request has already been used.", 409);
      return { order: existing, created: false };
    }
    const settings = await getSettings();
    if (
      !isValidDelivery(input.deliverySelection) ||
      !settings.slots.some(
        (s) => s.enabled && s.id === input.deliverySelection.slot,
      )
    )
      throw bad(
        "That delivery slot is no longer available. Please select another time.",
      );
    if (
      !settings.zones.some((z) => z.enabled && z.name === input.customer.area)
    )
      throw bad("Delivery is unavailable in this area.");
    if (input.payment === "online" && (!paymentsEnabled() || !user))
      throw bad(
        "Online payment requires an account and a configured payment gateway.",
      );
    const catalog = await getCatalog();
    const quantities = new Map<string, number>();
    for (const item of input.items)
      quantities.set(
        item.productId,
        (quantities.get(item.productId) || 0) + item.quantity,
      );
    const items = [...quantities].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
    if (
      items.some((i) => {
        const p = catalog.find((p) => p.id === i.productId);
        return !p || p.active === false || i.quantity > p.stock;
      })
    )
      throw bad(
        "Some items are unavailable or exceed current stock. Please refresh your cart.",
        409,
      );
    if (
      input.promo &&
      !settings.promos.some(
        (p) => p.active && p.code === input.promo!.toUpperCase(),
      )
    )
      throw bad("This promo code is not valid.");
    const totals = cartTotals(
      items,
      catalog,
      input.promo,
      settings,
      input.customer.area,
    );
    if (
      input.expectedTotal !== undefined &&
      Math.abs(input.expectedTotal - totals.total) > 0.001
    )
      throw bad(
        "Prices or delivery charges changed. Refresh checkout to review your updated total.",
        409,
      );
    if (
      input.payment === "online" &&
      (totals.total < 10 || totals.total > 500000)
    )
      throw bad("Online payment supports totals from ৳10 to ৳500,000.");
    const order: OrderRecord = {
      reference,
      customer: input.customer,
      items: items.map((i) => {
        const p = catalog.find((p) => p.id === i.productId)!;
        return {
          ...i,
          name: p.name,
          unit: p.unit,
          atlas: p.atlas,
          imageUrl: p.imageUrl,
          price: p.price,
        };
      }),
      ...totals,
      promoCode: input.promo?.toUpperCase(),
      payment: input.payment,
      paymentStatus: input.payment === "online" ? "pending" : "unpaid",
      status: "placed",
      mode: databaseMode(),
      deliverySelection: input.deliverySelection,
      instructions: input.instructions,
      accessTokenHash: hash(input.accessToken),
      fingerprint,
      createdAt: new Date().toISOString(),
      inventoryReserved: true,
      userId: user?.id,
      email: user?.email,
      sandbox:
        input.payment === "online"
          ? process.env.SSLCOMMERZ_LIVE !== "true"
          : undefined,
    };
    await saveOrder(order);
    await audit(user || undefined, "order.placed", reference, "Order received");
    for (const item of items) {
      const p = catalog.find((p) => p.id === item.productId)!;
      await stockEvent(
        undefined,
        p.id,
        p.stock,
        p.stock - item.quantity,
        `Order reservation ${reference}`,
      );
    }
    await saveCatalog(
      catalog.map((p) => ({
        ...p,
        stock: p.stock - (quantities.get(p.id) || 0),
        version: (p.version || 0) + (quantities.has(p.id) ? 1 : 0),
      })),
    );
    return { order, created: true };
  });
}
const transitions: Record<string, string[]> = {
  placed: ["preparing", "cancelled"],
  preparing: ["out-for-delivery", "cancelled"],
  "out-for-delivery": ["delivered"],
  delivered: [],
  cancelled: [],
};
export async function changeStatus(
  reference: string,
  status: string,
  actor?: { id: string; name: string },
) {
  return atomic(async () => {
    const order = await findOrder(reference);
    if (!order) throw bad("Order not found.", 404);
    if (order.status === status) return order;
    if (!transitions[order.status]?.includes(status))
      throw bad("This order status transition is not allowed.", 409);
    if (
      status !== "cancelled" &&
      order.payment === "online" &&
      order.paymentStatus !== "paid"
    )
      throw bad("Verify payment before preparing this order.", 409);
    if (status === "cancelled") {
      if (order.paymentStatus === "paid" || order.paymentStatus === "review")
        throw bad(
          "Paid or review payments need a manual refund before cancellation.",
          409,
        );
      const catalog = await getCatalog();
      if (order.inventoryReserved) {
        for (const item of order.items) {
          const p = catalog.find((p) => p.id === item.productId);
          if (p)
            await stockEvent(
              actor,
              p.id,
              p.stock,
              p.stock + item.quantity,
              `Cancelled order ${reference}`,
            );
        }
        await saveCatalog(
          catalog.map((p) => {
            const item = order.items.find((i) => i.productId === p.id);
            return {
              ...p,
              stock: p.stock + (item?.quantity || 0),
              version: (p.version || 0) + (item ? 1 : 0),
            };
          }),
        );
      }
    }
    const updated = {
      ...order,
      inventoryReserved:
        status === "cancelled" ? false : order.inventoryReserved,
      status: status as OrderRecord["status"],
      updatedAt: new Date().toISOString(),
    };
    await replaceOrder(updated);
    await audit(
      actor,
      "order.status",
      reference,
      `${order.status} → ${status}`,
    );
    return updated;
  });
}
