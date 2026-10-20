import { randomBytes } from "node:crypto";
import type { OrderRecord } from "../src/lib/orders";
import { atomic, readEntity, writeEntity } from "./repository";
import { findOrder, replaceOrder } from "./store";
import { bad } from "./validation";
import { paymentsEnabled } from "./checkout";
const host = () =>
  process.env.SSLCOMMERZ_LIVE === "true"
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";
export async function initiatePayment(order: OrderRecord) {
  const fresh = await atomic(async () => {
    if (!paymentsEnabled())
      throw bad("Payment gateway is not configured.", 503);
    const fresh = await findOrder(order.reference);
    if (
      !fresh ||
      fresh.status !== "placed" ||
      fresh.payment !== "online" ||
      fresh.paymentStatus !== "pending"
    )
      throw bad("This order cannot accept a new payment.", 409);
    if (fresh.paymentUrl) return fresh;
    if (fresh.transactionId)
      throw bad(
        "The gateway session is still being confirmed. Refresh your order; unpaid reservations expire after 30 minutes.",
        409,
      );
    const transactionId = `F${randomBytes(12).toString("hex")}`;
    const prepared = { ...fresh, transactionId };
    await writeEntity(`transaction:${transactionId}`, fresh.reference);
    await replaceOrder(prepared);
    return prepared;
  });
  if (fresh.paymentUrl) return fresh.paymentUrl;
  const api = process.env.PUBLIC_API_URL!.replace(/\/$/, "");
  const form = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    total_amount: fresh.total.toFixed(2),
    currency: "BDT",
    tran_id: fresh.transactionId!,
    success_url: `${api}/api/payments/return`,
    fail_url: `${api}/api/payments/return`,
    cancel_url: `${api}/api/payments/return`,
    ipn_url: `${api}/api/payments/ipn`,
    cus_name: fresh.customer.name,
    cus_email: fresh.email!,
    cus_add1: fresh.customer.address,
    cus_city: "Dhaka",
    cus_state: fresh.customer.area,
    cus_postcode: "1200",
    cus_country: "Bangladesh",
    cus_phone: fresh.customer.phone,
    shipping_method: "NO",
    product_name: "FreshCart groceries",
    product_category: "groceries",
    product_profile: "physical-goods",
    num_of_item: String(fresh.items.length),
    emi_option: "0",
  });
  const response = await fetch(`${host()}/gwprocess/v4/api.php`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (
    !response.ok ||
    result.status !== "SUCCESS" ||
    typeof result.GatewayPageURL !== "string"
  )
    throw bad(
      "The payment gateway could not confirm a session. Check your order before trying a new checkout.",
      502,
    );
  const url = new URL(result.GatewayPageURL);
  if (url.protocol !== "https:" || !/(^|\.)sslcommerz\.com$/.test(url.hostname))
    throw bad("Invalid payment gateway response.", 502);
  await atomic(async () => {
    const current = await findOrder(fresh.reference);
    if (
      !current ||
      current.status !== "placed" ||
      current.paymentStatus !== "pending"
    )
      throw bad("Order status changed. Please refresh your order.", 409);
    await replaceOrder({ ...current, paymentUrl: url.href });
  });
  return url.href;
}
export async function verifyPayment(valId: string) {
  if (!paymentsEnabled()) throw bad("Payment gateway is not configured.", 503);
  const url = new URL(`${host()}/validator/api/validationserverAPI.php`);
  url.search = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    format: "json",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (
    !response.ok ||
    !["VALID", "VALIDATED"].includes(result.status) ||
    result.currency !== "BDT" ||
    result.val_id !== valId
  )
    throw bad("Payment could not be verified.", 400);
  return atomic(async () => {
    const reference = await readEntity<string>(`transaction:${result.tran_id}`);
    const order = reference ? await findOrder(reference) : null;
    if (
      !order ||
      order.transactionId !== result.tran_id ||
      Math.abs(Number(result.amount) - order.total) > 0.001 ||
      !Number.isFinite(Number(result.amount))
    )
      throw bad("Payment does not match this order.", 400);
    const used = await readEntity<string>(`validation:${valId}`);
    if (used && used !== reference) throw bad("Payment already used.", 409);
    if (order.paymentStatus === "paid" || order.paymentStatus === "review")
      return order;
    const updated = {
      ...order,
      gatewayValidationId: valId,
      paymentStatus: (String(result.risk_level) === "0" &&
      order.status !== "cancelled"
        ? "paid"
        : "review") as OrderRecord["paymentStatus"],
      updatedAt: new Date().toISOString(),
    };
    await writeEntity(`validation:${valId}`, reference);
    await replaceOrder(updated);
    return updated;
  });
}
