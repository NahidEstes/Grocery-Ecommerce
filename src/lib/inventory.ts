export type Supplier = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
  version: number;
  updatedAt: string;
};
export type InventoryBatch = {
  id: string;
  productId: string;
  supplierId: string;
  batchNumber: string;
  receivedOn: string;
  expiresOn: string | null;
  unitCost: number;
  received: number;
  remaining: number;
  version: number;
  createdAt: string;
};
export type BatchAllocation = {
  batchId: string;
  productId: string;
  quantity: number;
};
export function dhakaDate(now = new Date(), timeZone = "Asia/Dhaka") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
/** Expiry is inclusive through the labelled merchant-local date. */
export const isExpired = (batch: InventoryBatch, date = dhakaDate()) =>
  !!batch.expiresOn && batch.expiresOn < date;
export function stockSummary(
  stock: number,
  batches: InventoryBatch[],
  date = dhakaDate(),
) {
  const tracked = batches.reduce((n, b) => n + b.remaining, 0);
  const expired = batches
    .filter((b) => isExpired(b, date))
    .reduce((n, b) => n + b.remaining, 0);
  return {
    tracked,
    untracked: Math.max(0, stock - tracked),
    expired,
    sellable: Math.max(0, stock - expired),
  };
}
export function allocateBatches(
  productId: string,
  quantity: number,
  stock: number,
  batches: InventoryBatch[],
  through = dhakaDate(),
): BatchAllocation[] {
  const matching = batches.filter((b) => b.productId === productId);
  const available = matching
    .filter((b) => !isExpired(b, through) && b.remaining > 0)
    .sort(
      (a, b) =>
        (a.expiresOn || "9999").localeCompare(b.expiresOn || "9999") ||
        a.receivedOn.localeCompare(b.receivedOn) ||
        a.id.localeCompare(b.id),
    );
  const summary = stockSummary(stock, matching, through);
  if (summary.tracked > stock || quantity > summary.sellable)
    throw new Error("Insufficient sellable batch stock");
  let left = quantity;
  const allocations: BatchAllocation[] = [];
  for (const batch of available) {
    const take = Math.min(left, batch.remaining);
    if (take)
      allocations.push({ batchId: batch.id, productId, quantity: take });
    left -= take;
    if (!left) break;
  }
  if (left > summary.untracked) throw new Error("Insufficient untracked stock");
  return allocations;
}
