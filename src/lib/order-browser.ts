import type { OrderReceipt, SavedAddress } from "./orders";

const inMemoryReceipts = new Map<string, OrderReceipt>();
export function forgetOrders() {
  inMemoryReceipts.clear();
}
export function readReceipts(): OrderReceipt[] {
  let stored: unknown = [];
  try {
    stored = JSON.parse(localStorage.getItem("freshcart-orders") || "[]");
  } catch {
    /* Browser storage can be unavailable. */
  }
  const result = new Map(inMemoryReceipts);
  if (Array.isArray(stored))
    for (const item of stored) {
      if (
        item &&
        /^FC-[A-F0-9]{8,12}$/.test(item.reference) &&
        typeof item.accessToken === "string" &&
        item.accessToken.length >= 32 &&
        typeof item.createdAt === "string" &&
        Number.isFinite(Date.parse(item.createdAt)) &&
        Number.isFinite(item.total)
      )
        result.set(item.reference, item);
    }
  return [...result.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
}
export function rememberOrder(receipt: OrderReceipt) {
  inMemoryReceipts.set(receipt.reference, receipt);
  const all = readReceipts();
  try {
    localStorage.setItem("freshcart-orders", JSON.stringify(all));
  } catch {
    /* Receipt remains available for this browser session. */
  }
}
export function readAddresses(): SavedAddress[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("freshcart-addresses") || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          ["Home", "Office", "Other"].includes(item.label) &&
          typeof item.name === "string" &&
          typeof item.phone === "string" &&
          typeof item.address === "string" &&
          typeof item.area === "string" &&
          item.area.length > 0 &&
          item.area.length <= 80,
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}
export function saveAddresses(addresses: SavedAddress[]) {
  try {
    localStorage.setItem("freshcart-addresses", JSON.stringify(addresses));
    return true;
  } catch {
    return false;
  }
}
