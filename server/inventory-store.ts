import { listEntities, readEntity, writeEntity } from "./repository";
import type { Product } from "../src/lib/catalog";
import {
  type InventoryBatch,
  type BatchAllocation,
  stockSummary,
} from "../src/lib/inventory";
import { bad } from "./validation";
export const getBatches = () => listEntities<InventoryBatch>("batch:");
export async function assertBatchStock(catalog: Product[]) {
  const batches = await getBatches();
  for (const product of catalog) {
    if (
      stockSummary(
        product.stock,
        batches.filter((b) => b.productId === product.id),
      ).tracked > product.stock
    )
      throw bad(
        "Stock cannot be lower than remaining batch packs. Withdraw batch packs in Suppliers & batches first.",
        409,
      );
  }
}
export async function changeBatchReservations(
  allocations: BatchAllocation[],
  restoring = false,
) {
  for (const item of allocations) {
    const batch = await readEntity<InventoryBatch>(`batch:${item.batchId}`);
    if (!batch || batch.productId !== item.productId)
      throw bad("A batch reservation could not be reconciled.", 409);
    const remaining =
      batch.remaining + (restoring ? item.quantity : -item.quantity);
    if (remaining < 0 || remaining > batch.received)
      throw bad("Batch quantity changed. Refresh before retrying.", 409);
    await writeEntity(`batch:${batch.id}`, {
      ...batch,
      remaining,
      version: batch.version + 1,
    });
  }
}
