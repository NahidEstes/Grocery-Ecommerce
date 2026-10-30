import { z } from "zod";
import { translationsSchema } from "./content-language-validation";
import { defaultProfile, normalizePhone } from "../src/lib/store-profile";
import type { StoreSettings } from "../src/lib/storefront";
export const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^[+\d\s().-]+$/),
  address: z.string().trim().min(10).max(300),
  area: z.string().trim().min(1).max(80),
});
export function validateCustomer(
  customer: z.infer<typeof customerSchema>,
  settings: StoreSettings,
) {
  if (!normalizePhone(customer.phone, settings.profile))
    throw bad("Please enter a valid phone number for this store's country.");
  if (
    !settings.zones.some((zone) => zone.enabled && zone.name === customer.area)
  )
    throw bad("This delivery area is unavailable.");
}
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(150),
  logoUrl: z
    .string()
    .refine(
      (v) =>
        /^\/(?!\/)[\w/.-]+\.(svg|png|webp|jpg)$/.test(v) ||
        /^https:\/\//.test(v),
      "Use a local asset path or HTTPS URL",
    )
    .max(500),
  supportEmail: z.union([z.literal(""), z.email()]),
  supportPhone: z.string().max(40),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .refine((v) => {
      try {
        return (
          new Intl.NumberFormat("en", {
            style: "currency",
            currency: v,
          }).resolvedOptions().maximumFractionDigits === 2 &&
          Intl.supportedValuesOf("currency").includes(v)
        );
      } catch {
        return false;
      }
    }, "Choose a supported currency with two decimal places"),
  timeZone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA time zone"),
  country: z.string().regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().max(20),
  callingCode: z.string().regex(/^[1-9]\d{0,3}$/),
  nationalPrefix: z.string().regex(/^\d{0,3}$/),
  nationalLengths: z.array(z.number().int().min(4).max(14)).min(1).max(8),
  nationalStarts: z.array(z.string().regex(/^\d{1,5}$/)).max(30),
  policies: z.object({
    terms: z.string().min(10).max(6000),
    privacy: z.string().min(10).max(6000),
    returns: z.string().min(10).max(6000),
    reservations: z.string().min(10).max(6000),
  }),
});
export const addressSchema = customerSchema.extend({
  id: z.string().uuid(),
  label: z.enum(["Home", "Office", "Other"]),
});
const key = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);
export const productSchema = z
  .object({
    id: key,
    slug: key,
    parentId: key.optional(),
    name: z.string().trim().min(2).max(120),
    translations: translationsSchema,
    category: key,
    unit: z.string().trim().min(1).max(60),
    price: z.number().min(0.01).max(500000).multipleOf(0.01),
    originalPrice: z
      .number()
      .positive()
      .max(500000)
      .multipleOf(0.01)
      .optional(),
    atlas: z.number().int().min(0).max(11),
    stock: z.number().int().min(0).max(100000),
    lowStockThreshold: z.number().int().min(0).max(100000).optional(),
    searchTerms: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    description: z.string().max(2000),
    organic: z.boolean().optional(),
    rating: z.number().min(0).max(5).default(0),
    brand: z.string().trim().max(80).optional(),
    dietary: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
    measure: z.number().positive().max(10000).optional(),
    measureUnit: z.enum(["kg", "litre", "piece"]).optional(),
    origin: z.string().max(150).optional(),
    nutrition: z.string().max(1500).optional(),
    allergens: z.string().max(1000).optional(),
    storage: z.string().max(1000).optional(),
    imageUrl: z
      .union([
        z.literal(""),
        z.string().regex(/^\/api\/media\/[a-f0-9-]+\.(?:png|jpg|webp)$/),
        z
          .url()
          .refine((v) => v.startsWith("https://"), "Use an HTTPS image URL"),
      ])
      .optional(),
    seasonal: z.boolean().optional(),
    active: z.boolean().optional(),
    createdAt: z.iso.datetime().optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .refine(
    (p) => !p.originalPrice || p.originalPrice >= p.price,
    "Original price must be at least the selling price",
  )
  .refine(
    (p) => !p.parentId || p.parentId !== p.id,
    "A variant cannot reference itself",
  );
export const settingsSchema = z
  .object({
    profile: profileSchema.default(defaultProfile),
    categories: z
      .array(
        z.object({
          slug: key,
          name: z.string().min(1).max(80),
          atlas: z.number().int().min(0).max(11),
        }),
      )
      .min(1)
      .max(30),
    zones: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          enabled: z.boolean(),
          fee: z.number().nonnegative().max(1000).multipleOf(0.01),
          estimate: z.string().min(1).max(160),
        }),
      )
      .min(1)
      .max(100),
    slots: z
      .array(
        z.object({
          id: z.enum(["morning", "afternoon", "evening"]),
          enabled: z.boolean(),
        }),
      )
      .length(3),
    freeDeliveryAt: z.number().positive().max(100000).multipleOf(0.01),
    promos: z
      .array(
        z.object({
          code: z.string().regex(/^[A-Z0-9]{3,20}$/),
          percent: z.number().min(0).max(100),
          maxDiscount: z.number().min(0).max(50000).multipleOf(0.01),
          active: z.boolean(),
        }),
      )
      .max(30),
    bundles: z
      .array(
        z.object({
          id: key,
          name: z.string().min(2).max(100),
          description: z.string().max(300),
          active: z.boolean(),
          items: z
            .array(
              z.object({
                productId: key,
                quantity: z.number().int().min(1).max(100),
              }),
            )
            .min(1)
            .max(30),
        }),
      )
      .max(20),
    faqs: z
      .array(
        z.object({
          question: z.string().min(5).max(200),
          answer: z.string().min(5).max(1500),
        }),
      )
      .max(30),
    homeSections: z.object({
      seasonal: z.boolean(),
      arrivals: z.boolean(),
      popular: z.boolean(),
      bundles: z.boolean(),
      reviews: z.boolean(),
    }),
  })
  .superRefine((s, ctx) => {
    for (const [label, values] of [
      ["areas", s.zones.map((z) => z.name)],
      ["slots", s.slots.map((s) => s.id)],
      ["categories", s.categories.map((c) => c.slug)],
      ["promos", s.promos.map((p) => p.code)],
      ["bundles", s.bundles.map((b) => b.id)],
    ] as const)
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${label}` });
  });
export const orderSchema = z.object({
  expectedTotal: z.number().nonnegative().optional(),
  customer: customerSchema,
  items: z
    .array(
      z.object({ productId: key, quantity: z.number().int().min(1).max(100) }),
    )
    .min(1)
    .max(30),
  promo: z.string().max(20).optional(),
  deliverySelection: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: z.enum(["morning", "afternoon", "evening"]),
  }),
  instructions: z.string().trim().max(200).default(""),
  payment: z.enum(["cash-on-delivery", "online"]),
  acceptedTerms: z.literal(true),
  requestId: z.uuid(),
  accessToken: z.uuid(),
});
export const bad = (message: string, status = 400) =>
  Object.assign(new Error(message), { status, expose: true });
