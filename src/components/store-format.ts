"use client";
import { useShop } from "./shop-provider";
import { currencyText } from "@/lib/store-profile";
import { orderTime as timestamp } from "@/lib/orders";
import { unitPrice as perUnit } from "@/lib/storefront";
import type { Locale } from "@/lib/i18n";
import type { Product } from "@/lib/catalog";
export function useStoreFormat() {
  const { settings } = useShop();
  return {
    money: (value: number, currency = settings.profile.currency) =>
      currencyText(value, currency),
    orderTime: (
      value: string,
      locale: Locale = "en",
      timeZone = settings.profile.timeZone,
    ) => timestamp(value, locale, timeZone),
    unitPrice: (product: Product, locale: Locale = "en") =>
      perUnit(product, locale, settings.profile.currency),
  };
}
