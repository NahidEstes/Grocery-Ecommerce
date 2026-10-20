import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { placeOrder, changeStatus, expirePending } from "../server/checkout";
import { initiatePayment, verifyPayment } from "../server/payments";
import { getCatalog, findOrder, replaceOrder } from "../server/store";
import { atomic, readEntity } from "../server/repository";
import { register } from "../server/auth";
import { deliveryDays } from "../src/lib/orders";

test("payment verification: amounts, currencies, replay, stock reservations and expiry", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-payments-"));
  process.env.FRESHCART_DATA_DIR = directory;
  const env = {
    SSLCOMMERZ_STORE_ID: process.env.SSLCOMMERZ_STORE_ID,
    SSLCOMMERZ_STORE_PASSWORD: process.env.SSLCOMMERZ_STORE_PASSWORD,
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
    WEB_ORIGIN: process.env.WEB_ORIGIN,
    SSLCOMMERZ_LIVE: process.env.SSLCOMMERZ_LIVE,
  };
  const nativeFetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete process.env.FRESHCART_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });
  Object.assign(process.env, {
    SSLCOMMERZ_STORE_ID: "test-store",
    SSLCOMMERZ_STORE_PASSWORD: "test-only",
    PUBLIC_API_URL: "https://api.example.test",
    WEB_ORIGIN: "https://shop.example.test",
    SSLCOMMERZ_LIVE: "false",
  });
  const user = await register(
    "Payment Tester",
    "payment@example.test",
    "test-password-123",
  );
  const input = () => ({
    customer: {
      name: "Payment Tester",
      phone: "01712345678",
      address: "House 12, Road 7, Dhaka",
      area: "Dhanmondi" as const,
    },
    items: [{ productId: "banana", quantity: 1 }],
    deliverySelection: {
      date: deliveryDays()[1].date,
      slot: "afternoon" as const,
    },
    instructions: "",
    payment: "online" as const,
    acceptedTerms: true as const,
    requestId: randomUUID(),
    accessToken: randomUUID(),
  });
  const initialStock = (await getCatalog())[0].stock;
  const { order } = await placeOrder(input(), user);
  assert.equal(order.paymentStatus, "pending");
  assert.equal((await getCatalog())[0].stock, initialStock - 1);
  let transaction = "",
    validation: Record<string, unknown> = {};
  let starts = 0;
  globalThis.fetch = (async (url, options) => {
    const value = String(url);
    assert.ok(value.startsWith("https://sandbox.sslcommerz.com/"));
    if (value.includes("/gwprocess/")) {
      starts++;
      const body = options!.body as URLSearchParams;
      transaction = body.get("tran_id")!;
      assert.equal(body.get("total_amount"), order.total.toFixed(2));
      assert.equal(body.get("store_passwd"), "test-only");
      return Response.json({
        status: "SUCCESS",
        GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/test",
      });
    }
    return Response.json(validation);
  }) as typeof fetch;
  const url = await initiatePayment(order);
  assert.match(url, /sslcommerz/);
  assert.equal(await initiatePayment(order), url);
  assert.equal(starts, 1);
  await assert.rejects(
    () => changeStatus(order.reference, "preparing"),
    /Verify payment/,
  );
  validation = { status: "INVALID" };
  await assert.rejects(
    () => verifyPayment("validation-1"),
    /could not be verified/,
  );
  validation = {
    status: "VALID",
    currency: "BDT",
    tran_id: transaction,
    val_id: "validation-1",
    amount: order.total - 1,
    risk_level: "0",
  };
  await assert.rejects(() => verifyPayment("validation-1"), /does not match/);
  validation = { ...validation, amount: order.total, currency: "USD" };
  await assert.rejects(
    () => verifyPayment("validation-1"),
    /could not be verified/,
  );
  validation = { ...validation, currency: "BDT", tran_id: "unknown" };
  await assert.rejects(() => verifyPayment("validation-1"), /does not match/);
  validation = { ...validation, tran_id: transaction };
  const paid = await verifyPayment("validation-1");
  assert.equal(paid.paymentStatus, "paid");
  assert.equal((await verifyPayment("validation-1")).paymentStatus, "paid");
  assert.equal((await getCatalog())[0].stock, initialStock - 1);
  await changeStatus(order.reference, "preparing");
  assert.equal((await findOrder(order.reference))!.status, "preparing");
  await assert.rejects(
    () => changeStatus(order.reference, "cancelled"),
    /manual refund/,
  );
  const pending = (await placeOrder(input(), user)).order;
  await initiatePayment(pending);
  const lateTransaction = transaction;
  await atomic(async () => {
    await replaceOrder({
      ...(await findOrder(pending.reference))!,
      createdAt: new Date(Date.now() - 31 * 60000).toISOString(),
    });
    await expirePending();
  });
  assert.equal((await findOrder(pending.reference))!.status, "cancelled");
  assert.equal((await getCatalog())[0].stock, initialStock - 1);
  await assert.rejects(() => initiatePayment(pending), /cannot accept/);
  // No validation id can credit a second order.
  const expired = await findOrder(pending.reference);
  assert.notEqual(expired!.paymentStatus, "paid");
  assert.equal(await readEntity(`validation:validation-1`), order.reference);
  validation = {
    status: "VALID",
    currency: "BDT",
    tran_id: lateTransaction,
    val_id: "late-payment",
    amount: pending.total,
    risk_level: "0",
  };
  assert.equal((await verifyPayment("late-payment")).paymentStatus, "review");
  assert.equal((await getCatalog())[0].stock, initialStock - 1);
  const risky = (await placeOrder(input(), user)).order;
  await initiatePayment(risky);
  validation = {
    status: "VALID",
    currency: "BDT",
    tran_id: transaction,
    val_id: "risk-payment",
    amount: risky.total,
    risk_level: "1",
  };
  assert.equal((await verifyPayment("risk-payment")).paymentStatus, "review");
  await assert.rejects(
    () => changeStatus(risky.reference, "preparing"),
    /Verify payment/,
  );
});
