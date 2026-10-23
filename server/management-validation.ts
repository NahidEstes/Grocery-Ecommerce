import { z } from "zod";
import { homeSectionIds } from "../src/lib/management";
const key = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);
export const imagePath = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      /^https:\/\//.test(v) ||
      /^\/images\/[a-zA-Z0-9._-]+$/.test(v) ||
      /^\/api\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(v),
    "Use an uploaded image, a local image or HTTPS URL",
  );
const internalPath = z
  .string()
  .max(200)
  .refine(
    (v) =>
      /^\/(?:products(?:\/[a-z0-9-]+)?(?:\?[^#]*)?|recipes(?:\/[a-z0-9-]+)?|lists)$/.test(
        v,
      ),
    "Choose a products, recipes or lists link",
  );
const banner = z.object({
  eyebrow: z.string().trim().min(1).max(70),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(250),
  button: z.string().trim().min(2).max(50),
  href: internalPath,
  imageUrl: imagePath,
});
export const contentSchema = z
  .object({
    version: z.number().int().nonnegative(),
    hero: banner.extend({ highlight: z.string().trim().min(1).max(80) }),
    banners: z.array(banner).length(2),
    showRegular: z.boolean(),
    showActiveOrder: z.boolean(),
    showDeals: z.boolean(),
    dealsTitle: z.string().trim().min(2).max(100),
    sections: z
      .array(
        z.object({
          id: z.enum(homeSectionIds),
          title: z.string().trim().min(2).max(100),
          enabled: z.boolean(),
        }),
      )
      .length(homeSectionIds.length),
    aliases: z
      .array(
        z.object({
          term: z.string().trim().min(2).max(80),
          productIds: z.array(key).min(1).max(20),
        }),
      )
      .max(100),
    lowStockThreshold: z.number().int().min(0).max(100000),
  })
  .superRefine((c, ctx) => {
    if (new Set(c.sections.map((s) => s.id)).size !== homeSectionIds.length)
      ctx.addIssue({
        code: "custom",
        message: "Each homepage section must appear exactly once.",
      });
    if (
      new Set(c.aliases.map((a) => a.term.toLowerCase())).size !==
      c.aliases.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Search aliases must be unique.",
      });
  });
export const recipeSchema = z
  .object({
    slug: key,
    title: z.string().trim().min(2).max(100),
    eyebrow: z.string().trim().min(2).max(70),
    description: z.string().trim().min(10).max(400),
    minutes: z.number().int().min(1).max(600),
    servings: z.number().int().min(1).max(20),
    atlas: z.array(z.number().int().min(0).max(11)).min(1).max(3),
    version: z.number().int().nonnegative().default(0),
    active: z.boolean().default(true),
    imageUrl: imagePath.default(""),
    allergenNote: z.string().trim().max(1000),
    steps: z.array(z.string().trim().min(5).max(1000)).min(1).max(20),
    ingredients: z
      .array(
        z.object({
          id: key,
          name: z.string().trim().min(2).max(100),
          productId: key.optional(),
          amount: z.number().positive().max(1000).optional(),
          measureUnit: z.enum(["kg", "litre", "piece"]).optional(),
          pantry: z.string().trim().max(200).optional(),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((r, ctx) => {
    if (new Set(r.ingredients.map((i) => i.id)).size !== r.ingredients.length)
      ctx.addIssue({
        code: "custom",
        message: "Ingredient IDs must be unique.",
      });
    for (const i of r.ingredients) {
      if (i.productId && (!i.amount || !i.measureUnit))
        ctx.addIssue({
          code: "custom",
          message: "Linked ingredients need an amount and measurement unit.",
        });
      if (!i.productId && !i.pantry)
        ctx.addIssue({
          code: "custom",
          message: "Unlinked ingredients need a pantry description.",
        });
    }
  });
