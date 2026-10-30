import type { Product } from "./catalog";
import { defaultSettings, type StoreSettings } from "./storefront";
import { currencyText } from "./store-profile";
export type CartItem = { productId: string; quantity: number };
export const FREE_DELIVERY_AT = 1000;
export const DELIVERY_FEE = 40;
export const money = currencyText;
export function cartTotals(
  items: CartItem[],
  catalog: Product[],
  promo = "",
  settings: StoreSettings = defaultSettings,
  area = "Dhanmondi",
) {
  const subtotal =
    Math.round(
      100 *
        items.reduce(
          (sum, item) =>
            sum +
            (catalog.find((p) => p.id === item.productId)?.price || 0) *
              item.quantity,
          0,
        ),
    ) / 100;
  const promotion = settings.promos.find(
    (p) => p.active && p.code === promo.toUpperCase(),
  );
  const discount = promotion
    ? Math.min(
        promotion.maxDiscount,
        settings.profile.currency === "USD"
          ? Math.round(subtotal * promotion.percent) / 100
          : Math.round((subtotal * promotion.percent) / 100),
      )
    : 0;
  const delivery =
    subtotal === 0 || subtotal >= settings.freeDeliveryAt
      ? 0
      : (settings.zones.find((z) => z.name === area)?.fee ?? DELIVERY_FEE);
  return {
    subtotal,
    discount,
    delivery,
    total: Math.round((subtotal - discount + delivery) * 100) / 100,
    remaining: Math.max(
      0,
      Math.round((settings.freeDeliveryAt - subtotal) * 100) / 100,
    ),
  };
}
export function sanitizeCart(input: unknown, catalog: Product[]): CartItem[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const product = catalog.find((p) => p.id === item.productId);
    if (!product || product.active === false || !Number.isFinite(item.quantity))
      continue;
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
