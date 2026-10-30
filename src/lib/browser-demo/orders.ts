import { z } from "zod";
import { cartTotals, sanitizeCart, type CartItem } from "../commerce";
import { deliveryDays, type DeliverySelection } from "../orders";
import { demoCities, demoCity } from "./config";
import { demoCustomer, demoProducts, demoSettingsFor } from "./data";
import { readDemo, writeDemo } from "./storage";
import { normalizePhone } from "../store-profile";

const customerSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().regex(/^\+?1?[\d\s().-]{10,25}$/),
  street: z.string().min(5).max(200),
  city: z.string(),
  state: z.string(),
  zip: z.string().regex(/^\d{5}(?:-\d{4})?$/),
  country: z.literal("United States"),
  area: z.string(),
});
const receiptSchema = z.object({
  reference: z.string().regex(/^DEMO-[A-Z0-9-]+$/),
  currency: z.literal("USD"),
  createdAt: z.iso.datetime(),
  timeZone: z.enum([
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
  ]),
  customer: customerSchema,
  deliverySelection: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: z.enum(["morning", "afternoon", "evening"]),
  }),
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        unit: z.string(),
        atlas: z.number().int().min(0).max(11),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative().finite(),
      }),
    )
    .min(1),
  subtotal: z.number().nonnegative().finite(),
  discount: z.number().nonnegative().finite(),
  delivery: z.number().nonnegative().finite(),
  total: z.number().nonnegative().finite(),
  promo: z.string(),
});
export type DemoCustomer = z.infer<typeof customerSchema>;
export type DemoReceipt = z.infer<typeof receiptSchema>;
export function demoDays(area: string, now = new Date()) {
  const city = demoCity(area);
  return deliveryDays(now, city.timeZone).map((day) => ({
    ...day,
    slots: day.slots.filter((slot) =>
      (city.slots as readonly string[]).includes(slot.id),
    ),
  }));
}
export function readDemoOrders(): DemoReceipt[] {
  return readDemo(
    "orders",
    [],
    (value): value is DemoReceipt[] =>
      Array.isArray(value) &&
      value.length <= 50 &&
      value.every((order) => receiptSchema.safeParse(order).success),
  );
}
export function storeDemoOrder(receipt: DemoReceipt) {
  receiptSchema.parse(receipt);
  return writeDemo(
    "orders",
    [
      receipt,
      ...readDemoOrders().filter(
        (order) => order.reference !== receipt.reference,
      ),
    ].slice(0, 50),
  );
}
export function makeDemoOrder(
  items: CartItem[],
  area: string,
  promo: string,
  customer: DemoCustomer,
  selection: DeliverySelection,
  now = new Date(),
  id = crypto.randomUUID(),
): DemoReceipt {
  const city = demoCity(area);
  const result = customerSchema.safeParse(customer);
  if (!result.success)
    throw new Error(
      "Use a name, street address, valid US phone number and ZIP code.",
    );
  const parsed = result.data;
  if (!normalizePhone(parsed.phone, demoSettingsFor(area).profile))
    throw new Error(
      "Use a valid US phone number, for example +1 (202) 555-0142.",
    );
  if (
    parsed.area !== city.name ||
    parsed.city !== city.city ||
    parsed.state !== city.state
  )
    throw new Error("Choose a supported demo city and state.");
  if (
    !demoDays(area, now).some(
      (day) =>
        day.date === selection.date &&
        day.slots.some((slot) => slot.id === selection.slot),
    )
  )
    throw new Error("Choose an available delivery slot.");
  const cart = sanitizeCart(items, demoProducts);
  if (!cart.length) throw new Error("Your demo basket is empty.");
  const totals = cartTotals(
    cart,
    demoProducts,
    promo,
    demoSettingsFor(area),
    area,
  );
  return receiptSchema.parse({
    ...totals,
    reference: `DEMO-${id.toUpperCase()}`,
    currency: "USD",
    createdAt: now.toISOString(),
    timeZone: city.timeZone,
    customer: parsed,
    deliverySelection: selection,
    promo,
    items: cart.map((item) => {
      const product = demoProducts.find(
        (product) => product.id === item.productId,
      )!;
      return {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        atlas: product.atlas,
        quantity: item.quantity,
        price: product.price,
      };
    }),
  });
}
// Static admin fixtures never read customer/browser orders and cannot be mutated.
export const demoAdminOrders = demoCities.map((city, index) => {
  const area = city.name;
  const now = new Date("2026-10-20T12:00:00Z");
  const day = demoDays(area, now).find((day) => day.slots.length)!;
  return makeDemoOrder(
    [
      { productId: "apple", quantity: index + 1 },
      { productId: "milk", quantity: 1 },
    ],
    area,
    "FRESH10",
    demoCustomer(area),
    { date: day.date, slot: day.slots[0].id },
    now,
    `SAMPLE-${index + 1}`,
  );
});
