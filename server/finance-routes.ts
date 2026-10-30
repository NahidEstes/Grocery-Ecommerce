import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "./auth";
import { atomic } from "./repository";
import { findOrder, replaceOrder } from "./store";
import { changeStatus, publicOrder } from "./checkout";
import { orderFinance, recordFinance } from "./finance-store";
import { refundedAmount } from "../src/lib/finance";
import { bad } from "./validation";
export const financeRoutes = Router();
financeRoutes.get("/admin/orders/:reference/finance", async (req, res) => {
  await requirePermission(req, "finance");
  const result = await atomic(async () => {
    const order = await findOrder(String(req.params.reference));
    if (!order) throw bad("Order not found.", 404);
    const finance = await orderFinance(order);
    return {
      order: publicOrder(order),
      finance,
      refunded: refundedAmount(finance),
    };
  });
  res.json(result);
});
financeRoutes.post("/admin/orders/:reference/finance", async (req, res) => {
  const actor = await requirePermission(req, "finance");
  const input = z
    .object({
      id: z.uuid(),
      version: z.number().int().nonnegative(),
      kind: z.enum(["reconciliation", "refund"]),
      amount: z.number().nonnegative().max(500000).multipleOf(0.01),
      method: z.string().trim().min(2).max(80),
      reference: z.string().trim().min(3).max(150),
      note: z.string().trim().min(5).max(1000),
    })
    .strict()
    .parse(req.body);
  const finance = await atomic(async () => {
    const order = await findOrder(String(req.params.reference));
    if (!order) throw bad("Order not found.", 404);
    const result = await recordFinance(order, input, input.version, actor);
    await replaceOrder({
      ...order,
      financeRevision: (order.financeRevision || 0) + 1,
    });
    return result;
  });
  res.json({ finance, refunded: refundedAmount(finance) });
});
financeRoutes.post("/admin/orders/:reference/cancel", async (req, res) => {
  const actor = await requirePermission(req, "finance");
  const input = z
    .object({
      version: z.number().int().nonnegative(),
      stockRecovered: z.boolean().default(false),
    })
    .parse(req.body);
  const order = await atomic(async () => {
    const order = await findOrder(String(req.params.reference));
    if (!order) throw bad("Order not found.", 404);
    if (order.status === "cancelled") return order;
    if ((await orderFinance(order)).version !== input.version)
      throw bad("Financial records changed. Refresh before cancellation.", 409);
    return changeStatus(order.reference, "cancelled", actor, {
      stockRecovered: input.stockRecovered,
    });
  });
  res.json({ order: publicOrder(order) });
});
