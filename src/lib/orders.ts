import type { CartItem } from "./commerce";
import { localeTag, translate, type Locale } from "./i18n";

export const deliveryAreas = [
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Gulshan",
] as const;
export type DeliveryArea = (typeof deliveryAreas)[number];
export type Customer = {
  name: string;
  phone: string;
  address: string;
  area: DeliveryArea;
};
export type SavedAddress = Customer & {
  id: string;
  label: "Home" | "Office" | "Other";
};
export const deliverySlots = [
  { id: "morning", label: "10 AM – 12 PM", start: "10:00" },
  { id: "afternoon", label: "12 PM – 2 PM", start: "12:00" },
  { id: "evening", label: "4 PM – 6 PM", start: "16:00" },
] as const;
export type SlotId = (typeof deliverySlots)[number]["id"];
export type DeliverySelection = { date: string; slot: SlotId };
export type OrderStatus =
  "placed" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";
export type Order = {
  reference: string;
  customer: Customer;
  items: {
    productId: string;
    name: string;
    unit: string;
    atlas: number;
    imageUrl?: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  delivery: number;
  total: number;
  deliverySelection: DeliverySelection;
  instructions: string;
  payment: "cash-on-delivery" | "online";
  paymentStatus?: "unpaid" | "pending" | "paid" | "review";
  transactionId?: string;
  paymentUrl?: string;
  gatewayValidationId?: string;
  userId?: string;
  email?: string;
  sandbox?: boolean;
  status: OrderStatus;
  mode: "demo" | "mongodb";
  createdAt: string;
  updatedAt?: string;
  inventoryReserved?: boolean;
};
export type OrderRecord = Order & {
  accessTokenHash: string;
  fingerprint: string;
};
export type OrderReceipt = {
  reference: string;
  accessToken: string;
  total: number;
  createdAt: string;
};
export type CheckoutInput = {
  expectedTotal?: number;
  customer: Customer;
  items: CartItem[];
  promo?: string;
  deliverySelection: DeliverySelection;
  instructions: string;
  payment: "cash-on-delivery" | "online";
  acceptedTerms: true;
  requestId: string;
  accessToken: string;
};

// The store delivers in Dhaka; delivery slots are explicitly shown in Dhaka time.
export function deliveryDays(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) =>
    Number(parts.find((p) => p.type === name)!.value);
  return Array.from({ length: 5 }, (_, offset) => {
    const day = new Date(
      Date.UTC(part("year"), part("month") - 1, part("day") + offset, 12),
    );
    const date = day.toISOString().slice(0, 10);
    return {
      date,
      label:
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : day.toLocaleDateString("en-GB", {
                weekday: "short",
                timeZone: "UTC",
              }),
      short: day.toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      slots: deliverySlots.filter(
        (slot) =>
          new Date(`${date}T${slot.start}:00+06:00`).getTime() >
          now.getTime() + 60 * 60 * 1000,
      ),
    };
  });
}
export function isValidDelivery(
  selection: DeliverySelection,
  now = new Date(),
) {
  return deliveryDays(now).some(
    (day) =>
      day.date === selection.date &&
      day.slots.some((slot) => slot.id === selection.slot),
  );
}
export function formatDelivery(
  selection: DeliverySelection,
  locale: Locale = "en",
) {
  const date = new Date(`${selection.date}T12:00:00+06:00`);
  const day = Number.isFinite(date.getTime())
    ? date.toLocaleDateString(localeTag(locale), {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      })
    : selection.date;
  return `${day}, ${translate(locale, deliverySlots.find((slot) => slot.id === selection.slot)?.label || "")}`;
}
export function orderTime(value: string, locale: Locale = "en") {
  return new Date(value).toLocaleString(localeTag(locale), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka",
  });
}
