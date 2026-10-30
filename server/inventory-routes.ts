import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requirePermission } from "./auth";
import { atomic, listEntities, readEntity, writeEntity } from "./repository";
import { getCatalog, saveCatalog, getSettings } from "./store";
import { getBatches } from "./inventory-store";
import { audit, stockEvent } from "./management-store";
import { bad } from "./validation";
import {
  dhakaDate,
  stockSummary,
  type Supplier,
  type InventoryBatch,
} from "../src/lib/inventory";
export const inventoryRoutes = Router();
const date = z.iso.date();
const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(100),
  phone: z.string().trim().max(40),
  email: z.union([z.email().max(200), z.literal("")]),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(1000),
  active: z.boolean(),
  version: z.number().int().nonnegative(),
});
inventoryRoutes.get("/admin/purchasing", async (req, res) => {
  await requirePermission(req, "purchasing");
  res.json(
    await atomic(async () => {
      const today = dhakaDate(
        new Date(),
        (await getSettings()).profile.timeZone,
      );
      const batches = await getBatches(),
        catalog = await getCatalog();
      return {
        suppliers: await listEntities<Supplier>("supplier:"),
        batches,
        today,
        products: catalog.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          stock: p.stock,
          version: p.version || 0,
          ...stockSummary(
            p.stock,
            batches.filter((b) => b.productId === p.id),
            today,
          ),
        })),
      };
    }),
  );
});
inventoryRoutes.put("/admin/suppliers/:id", async (req, res) => {
  const actor = await requirePermission(req, "purchasing"),
    id = z.uuid().parse(req.params.id),
    input = supplierSchema.parse(req.body);
  const supplier = await atomic(async () => {
    const old = await readEntity<Supplier>(`supplier:${id}`);
    if ((old?.version || 0) !== input.version)
      throw bad("Supplier changed. Refresh first.", 409);
    const next: Supplier = {
      ...input,
      id,
      version: input.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await writeEntity(`supplier:${id}`, next);
    await audit(actor, "supplier.saved", id, "Supplier details saved");
    return next;
  });
  res.json({ supplier });
});
const receiptSchema = z.object({
  receiptId: z.uuid(),
  supplierId: z.uuid(),
  productId: z.string().min(1).max(60),
  batchNumber: z.string().trim().min(1).max(80),
  receivedOn: date,
  expiresOn: date.nullable(),
  quantity: z.number().int().min(1).max(100000),
  unitCost: z.number().nonnegative().max(500000).multipleOf(0.01),
});
inventoryRoutes.post("/admin/batches", async (req, res) => {
  const actor = await requirePermission(req, "purchasing"),
    input = receiptSchema.parse(req.body);
  const batch = await atomic(async () => {
    const old = await readEntity<InventoryBatch>(`batch:${input.receiptId}`);
    if (old) {
      if (
        old.supplierId !== input.supplierId ||
        old.productId !== input.productId ||
        old.batchNumber !== input.batchNumber ||
        old.received !== input.quantity ||
        old.unitCost !== input.unitCost ||
        old.receivedOn !== input.receivedOn ||
        old.expiresOn !== input.expiresOn
      )
        throw bad("This receipt ID has already been used.", 409);
      return old;
    }
    const today = dhakaDate(new Date(), (await getSettings()).profile.timeZone);
    if (
      input.receivedOn > today ||
      (input.expiresOn &&
        (input.expiresOn < today || input.expiresOn < input.receivedOn))
    )
      throw bad(
        "Check the receipt and expiry dates. Expired goods cannot be received as saleable stock.",
      );
    const supplier = await readEntity<Supplier>(`supplier:${input.supplierId}`);
    if (!supplier?.active) throw bad("Choose an active supplier.");
    const catalog = await getCatalog(),
      product = catalog.find((p) => p.id === input.productId);
    if (
      !product ||
      product.active === false ||
      product.stock + input.quantity > 100000
    )
      throw bad("Choose an active SKU with room for this receipt.");
    const next: InventoryBatch = {
      id: input.receiptId,
      productId: input.productId,
      supplierId: input.supplierId,
      batchNumber: input.batchNumber,
      receivedOn: input.receivedOn,
      expiresOn: input.expiresOn,
      unitCost: input.unitCost,
      received: input.quantity,
      remaining: input.quantity,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    await writeEntity(`batch:${next.id}`, next);
    await saveCatalog(
      catalog.map((p) =>
        p.id === product.id
          ? {
              ...p,
              stock: p.stock + input.quantity,
              version: (p.version || 0) + 1,
            }
          : p,
      ),
    );
    await stockEvent(
      actor,
      product.id,
      product.stock,
      product.stock + input.quantity,
      `Batch received: ${input.batchNumber}`,
    );
    await audit(
      actor,
      "batch.received",
      next.id,
      `${product.id}: ${input.quantity} packs received`,
    );
    return next;
  });
  res.json({ batch });
});
inventoryRoutes.post("/admin/batches/:id/withdraw", async (req, res) => {
  const actor = await requirePermission(req, "purchasing"),
    id = z.uuid().parse(req.params.id);
  const input = z
    .object({
      quantity: z.number().int().positive().max(100000),
      version: z.number().int().positive(),
      reason: z.string().trim().min(3).max(300),
    })
    .parse(req.body);
  await atomic(async () => {
    const batch = await readEntity<InventoryBatch>(`batch:${id}`);
    if (!batch) throw bad("Batch not found.", 404);
    if (batch.version !== input.version)
      throw bad("Batch changed. Refresh first.", 409);
    if (input.quantity > batch.remaining)
      throw bad("Withdrawal exceeds remaining packs.", 409);
    const catalog = await getCatalog(),
      product = catalog.find((p) => p.id === batch.productId);
    if (!product || product.stock < input.quantity)
      throw bad("Stock could not be reconciled.", 409);
    await writeEntity(`batch:${id}`, {
      ...batch,
      remaining: batch.remaining - input.quantity,
      version: batch.version + 1,
    });
    await saveCatalog(
      catalog.map((p) =>
        p.id === product.id
          ? {
              ...p,
              stock: p.stock - input.quantity,
              version: (p.version || 0) + 1,
            }
          : p,
      ),
    );
    const eventId = randomUUID();
    await writeEntity(`batch-withdrawal:${eventId}`, {
      id: eventId,
      batchId: id,
      quantity: input.quantity,
      reason: input.reason,
      actor: actor.name,
      at: new Date().toISOString(),
    });
    await stockEvent(
      actor,
      product.id,
      product.stock,
      product.stock - input.quantity,
      `Batch withdrawal: ${batch.batchNumber}. ${input.reason}`,
    );
    await audit(
      actor,
      "batch.withdrawn",
      id,
      `${input.quantity} packs: ${input.reason}`,
    );
  });
  res.json({ ok: true });
});
