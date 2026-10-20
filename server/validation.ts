import { z } from "zod";
export const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  address: z.string().trim().min(10).max(300),
  area: z.enum(["Dhanmondi", "Mirpur", "Uttara", "Gulshan"]),
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
          name: z.enum(["Dhanmondi", "Mirpur", "Uttara", "Gulshan"]),
          enabled: z.boolean(),
          fee: z.number().nonnegative().max(1000).multipleOf(0.01),
          estimate: z.string().min(1).max(160),
        }),
      )
      .length(4),
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
