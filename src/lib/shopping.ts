import type { Product } from "./catalog";
import type { CartItem } from "./commerce";
import type { Order, OrderRecord } from "./orders";

export type ShoppingListEntry = CartItem & { name: string; unit: string };
export type ShoppingList = {
  id: string;
  name: string;
  notes: string;
  items: ShoppingListEntry[];
  version: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};
export type ShoppingListRecord = ShoppingList & { userId: string };
export type ShoppingListInput = {
  name: string;
  notes?: string;
  items: CartItem[];
};
export type RegularPurchase = {
  productId: string;
  name: string;
  unit: string;
  atlas: number;
  quantity: number;
  purchaseCount: number;
  lastOrderedAt: string;
};
export type ActiveOrder = Pick<
  Order,
  | "reference"
  | "status"
  | "payment"
  | "paymentStatus"
  | "deliverySelection"
  | "mode"
  | "createdAt"
>;
export type ShoppingSummary = {
  regular: RegularPurchase[];
  activeOrder: ActiveOrder | null;
  lists: ShoppingList[];
};
export function regularPurchases(orders: OrderRecord[], userId: string) {
  const eligible = orders
    .filter(
      (o) =>
        o.userId === userId &&
        o.status !== "cancelled" &&
        (o.payment !== "online" || o.paymentStatus === "paid"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = new Map<string, RegularPurchase>();
  for (const order of eligible) {
    const seen = new Set<string>();
    for (const item of order.items) {
      if (seen.has(item.productId)) continue;
      seen.add(item.productId);
      const prior = result.get(item.productId);
      if (prior) prior.purchaseCount++;
      else
        result.set(item.productId, {
          productId: item.productId,
          name: item.name,
          unit: item.unit,
          atlas: item.atlas,
          quantity: item.quantity,
          purchaseCount: 1,
          lastOrderedAt: order.createdAt,
        });
    }
  }
  return [...result.values()]
    .sort(
      (a, b) =>
        b.purchaseCount - a.purchaseCount ||
        b.lastOrderedAt.localeCompare(a.lastOrderedAt) ||
        a.productId.localeCompare(b.productId),
    )
    .slice(0, 12);
}
export function activeOrder(
  orders: OrderRecord[],
  userId: string,
): ActiveOrder | null {
  const order = orders
    .filter(
      (o) =>
        o.userId === userId && !["cancelled", "delivered"].includes(o.status),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!order) return null;
  const {
    reference,
    status,
    payment,
    paymentStatus,
    deliverySelection,
    mode,
    createdAt,
  } = order;
  return {
    reference,
    status,
    payment,
    paymentStatus,
    deliverySelection,
    mode,
    createdAt,
  };
}
export type BasketIssue = {
  productId: string;
  reason: "unavailable" | "limited";
  requested: number;
  available: number;
};
export function planBasket(
  incoming: CartItem[],
  catalog: Product[],
  current: CartItem[] = [],
) {
  const requested = new Map<string, number>();
  for (const item of incoming)
    if (Number.isInteger(item.quantity) && item.quantity > 0)
      requested.set(
        item.productId,
        (requested.get(item.productId) || 0) + item.quantity,
      );
  const additions: CartItem[] = [],
    issues: BasketIssue[] = [];
  for (const [productId, quantity] of requested) {
    const product = catalog.find((p) => p.id === productId);
    if (!product || product.active === false || product.stock < 1) {
      issues.push({
        productId,
        requested: quantity,
        available: 0,
        reason: "unavailable",
      });
      continue;
    }
    const room = Math.max(
      0,
      Math.min(100, product.stock) -
        (current.find((i) => i.productId === productId)?.quantity || 0),
    );
    const available = Math.min(quantity, room);
    if (available > 0) additions.push({ productId, quantity: available });
    if (available < quantity)
      issues.push({
        productId,
        requested: quantity,
        available,
        reason: "limited",
      });
  }
  const subtotal =
    Math.round(
      additions.reduce(
        (n, i) =>
          n + catalog.find((p) => p.id === i.productId)!.price * i.quantity,
        0,
      ) * 100,
    ) / 100;
  return { additions, issues, subtotal };
}
