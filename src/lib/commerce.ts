import type { Product } from "./catalog";
export type CartItem = { productId: string; quantity: number };
export const FREE_DELIVERY_AT = 1000;
export const DELIVERY_FEE = 40;
export const money = (value: number) => `৳ ${value.toLocaleString("en-BD")}`;
export function cartTotals(items: CartItem[], catalog: Product[], promo = "") {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (catalog.find((p) => p.id === item.productId)?.price || 0) *
        item.quantity,
    0,
  );
  const discount =
    promo.toUpperCase() === "FRESH10"
      ? Math.min(100, Math.round(subtotal * 0.1))
      : 0;
  const delivery =
    subtotal === 0 || subtotal >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE;
  return {
    subtotal,
    discount,
    delivery,
    total: subtotal - discount + delivery,
    remaining: Math.max(0, FREE_DELIVERY_AT - subtotal),
  };
}
export function sanitizeCart(input: unknown, catalog: Product[]): CartItem[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const product = catalog.find((p) => p.id === item.productId);
    if (!product || !Number.isFinite(item.quantity)) continue;
    const quantity = Math.max(
      0,
      Math.min(product.stock, Math.floor(item.quantity)),
    );
    merged.set(
      product.id,
      Math.min(product.stock, (merged.get(product.id) || 0) + quantity),
    );
  }
  return [...merged]
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}
