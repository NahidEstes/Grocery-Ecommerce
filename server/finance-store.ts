import { createHash } from "node:crypto";
import { readEntity, writeEntity, listEntities } from "./repository";
import type { ReturnRequest } from "../src/lib/management";
import { bad } from "./validation";
import { audit } from "./management-store";
import type { OrderRecord } from "../src/lib/orders";
import {
  cents,
  refundedAmount,
  type OrderFinance,
  type FinanceEvent,
} from "../src/lib/finance";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const basis = (order: OrderRecord) =>
  digest(
    JSON.stringify([
      order.paymentStatus,
      order.total,
      order.transactionId,
      order.gatewayValidationId,
      order.currency || "BDT",
    ]),
  );
export async function orderFinance(order: OrderRecord): Promise<OrderFinance> {
  const stored = await readEntity<OrderFinance>(`finance:${order.reference}`);
  const finance: OrderFinance = stored
    ? {
        ...stored,
        reconciled: stored.reconciled && stored.basis === basis(order),
      }
    : {
        reference: order.reference,
        version: 0,
        basis: basis(order),
        received:
          order.paymentStatus === "paid" ||
          order.paymentStatus === "review" ||
          (order.payment === "cash-on-delivery" && order.status === "delivered")
            ? order.total
            : 0,
        reconciled: order.paymentStatus !== "review",
        events: [],
      };
  const historical = (await listEntities<ReturnRequest>("return:")).filter(
    (r) =>
      r.reference === order.reference &&
      r.status === "refunded" &&
      !finance.events.some((e) => e.returnId === r.id),
  );
  finance.events = [
    ...finance.events,
    ...historical.map((r) => ({
      id: r.id,
      returnId: r.id,
      kind: "refund" as const,
      amount: r.amount,
      method: r.refundMethod || "Legacy external refund",
      reference: r.refundReference || r.id,
      note: "Imported existing refunded return; original staff identity unavailable.",
      staffId: "legacy",
      staffName: "Legacy record",
      at: r.updatedAt,
    })),
  ];
  return finance;
}
export async function assertCancellationSettled(order: OrderRecord) {
  if (!["paid", "review"].includes(order.paymentStatus || "")) return;
  const finance = await orderFinance(order);
  if (
    !finance.reconciled ||
    cents(finance.received) !== cents(refundedAmount(finance))
  )
    throw bad(
      "Record reconciliation and the full externally completed manual refund before cancellation.",
      409,
    );
}
type Entry = Pick<
  FinanceEvent,
  "id" | "kind" | "amount" | "method" | "reference" | "note" | "returnId"
>;
/** Caller owns the repository transaction and fences the order document. No money is transferred. */
export async function recordFinance(
  order: OrderRecord,
  input: Entry,
  version: number,
  actor: { id: string; name: string },
) {
  const finance = await orderFinance(order);
  const existing = finance.events.find((e) => e.id === input.id);
  if (existing) {
    if (
      ["kind", "amount", "method", "reference", "note", "returnId"].some(
        (k) =>
          (existing as unknown as Record<string, unknown>)[k] !==
          (input as unknown as Record<string, unknown>)[k],
      )
    )
      throw bad("This financial request ID has already been used.", 409);
    return finance;
  }
  if (finance.version !== version)
    throw bad(
      "Financial records changed. Refresh before recording this action.",
      409,
    );
  const refunded = refundedAmount(finance);
  if (input.kind === "reconciliation") {
    if (
      order.payment !== "online" ||
      !["paid", "review"].includes(order.paymentStatus || "")
    )
      throw bad(
        "Only received or review online payments can be reconciled.",
        409,
      );
    if (
      input.amount > order.total ||
      input.amount < refunded ||
      (order.paymentStatus === "paid" &&
        cents(input.amount) !== cents(order.total))
    )
      throw bad(
        "The received amount must cover recorded refunds and match a verified paid order.",
        409,
      );
  } else {
    if (
      !finance.reconciled ||
      input.amount <= 0 ||
      cents(refunded) + cents(input.amount) > cents(finance.received)
    )
      throw bad(
        "Refund exceeds reconciled funds or payment reconciliation is incomplete.",
        409,
      );
    if (order.status === "delivered" && !input.returnId)
      throw bad(
        "After delivery, record refunds through an approved return request.",
        409,
      );
    const key = `external-refund:${digest(`${input.method.toLowerCase()}:${input.reference.toLowerCase()}`)}`;
    if (await readEntity(key))
      throw bad(
        "This external refund method/reference is already recorded.",
        409,
      );
    await writeEntity(key, { order: order.reference, id: input.id });
  }
  const event: FinanceEvent = {
    ...input,
    staffId: actor.id,
    staffName: actor.name,
    at: new Date().toISOString(),
  };
  const next: OrderFinance = {
    ...finance,
    version: finance.version + 1,
    basis: basis(order),
    received: input.kind === "reconciliation" ? input.amount : finance.received,
    reconciled: input.kind === "reconciliation" ? true : finance.reconciled,
    events: [...finance.events, event],
  };
  await writeEntity(`finance:${order.reference}`, next);
  await audit(
    actor,
    `finance.${input.kind}`,
    order.reference,
    `${input.amount} ${order.currency || "BDT"}; ${input.method}; ${input.reference}`,
  );
  return next;
}
