import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { categories, filterProducts } from "../src/lib/catalog";
import { cartTotals } from "../src/lib/commerce";
import { databaseMode, getCatalog, saveOrder } from "./store";

export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.WEB_ORIGIN || "http://127.0.0.1:3000" }));
app.use(express.json({ limit: "16kb" }));
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-FreshCart-Service", "freshcart-api");
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "freshcart-api", storage: databaseMode() }),
);
app.get("/api/categories", (_req, res) => res.json({ categories }));
const querySchema = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(30).optional(),
  organic: z.enum(["true", "false"]).optional(),
  offers: z.enum(["true", "false"]).optional(),
  sort: z
    .enum(["featured", "price-asc", "price-desc", "rating", "name"])
    .optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});
app.get("/api/products", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid product filters." });
  const q = parsed.data;
  res.json(
    filterProducts(await getCatalog(), {
      ...q,
      organic: q.organic === "true",
      offers: q.offers === "true",
    }),
  );
});
app.get("/api/products/:slug", async (req, res) => {
  const product = (await getCatalog()).find((p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ message: "Product not found." });
  res.json({ product });
});
const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+?88)?01[3-9]\d{8}$/),
    address: z.string().trim().min(10).max(300),
    area: z.enum(["Dhanmondi", "Mirpur", "Uttara", "Gulshan"]),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().max(50),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(30),
  promo: z.string().max(20).optional(),
});
app.post("/api/orders", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({
        message:
          "Please enter a valid name, Bangladesh mobile number and delivery address.",
      });
  const catalog = await getCatalog();
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items)
    quantities.set(
      item.productId,
      (quantities.get(item.productId) || 0) + item.quantity,
    );
  const items = [...quantities].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
  if (
    items.some((item) => {
      const p = catalog.find((p) => p.id === item.productId);
      return !p || item.quantity > p.stock;
    })
  )
    return res
      .status(409)
      .json({
        message:
          "Some items are unavailable or exceed current stock. Please update your cart.",
      });
  if (parsed.data.promo && parsed.data.promo.toUpperCase() !== "FRESH10")
    return res.status(400).json({ message: "This promo code is not valid." });
  const totals = cartTotals(items, catalog, parsed.data.promo);
  const reference = `FC-${randomUUID().slice(0, 8).toUpperCase()}`;
  const order = {
    reference,
    customer: parsed.data.customer,
    items: items.map((item) => ({
      ...item,
      name: catalog.find((p) => p.id === item.productId)!.name,
      price: catalog.find((p) => p.id === item.productId)!.price,
    })),
    ...totals,
    payment: "cash-on-delivery",
    status: "placed",
    createdAt: new Date().toISOString(),
  };
  await saveOrder(order);
  res
    .status(201)
    .json({
      reference,
      total: totals.total,
      mode: databaseMode(),
      message:
        databaseMode() === "demo"
          ? "Demo order saved. No payment was collected and no delivery is scheduled."
          : "Order received. Payment method: cash on delivery.",
    });
});
app.use((_req, res) =>
  res.status(404).json({ message: "API route not found." }),
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error instanceof Error ? error.message : "API error");
    res
      .status(error instanceof SyntaxError ? 400 : 500)
      .json({
        message:
          error instanceof SyntaxError
            ? "Invalid JSON request."
            : "Something went wrong. Please try again.",
      });
  },
);
