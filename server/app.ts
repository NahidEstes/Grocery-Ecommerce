import express from "express";
import cors from "cors";
import { z } from "zod";
import { filterProducts } from "../src/lib/catalog";
import {
  databaseMode,
  getCatalog,
  getSettings,
  findOrder,
  updateOrderAddress,
  listOrders,
} from "./store";
import { currentUser } from "./auth";
import { accountRoutes } from "./account-routes";
import { adminRoutes } from "./admin-routes";
import { customerSchema, orderSchema, bad } from "./validation";
import { atomic, listEntities } from "./repository";
import {
  publicOrder,
  tokenAccess,
  placeOrder,
  paymentsEnabled,
  expirePending,
} from "./checkout";
import { initiatePayment, verifyPayment } from "./payments";
import type { OrderRecord } from "../src/lib/orders";
import type { Review } from "../src/lib/storefront";
import type { SupportTicket } from "../src/lib/storefront";
import { randomUUID } from "node:crypto";
import { writeEntity } from "./repository";
import { getPublicCatalog } from "./store";
import { shoppingRoutes } from "./shopping-routes";
export const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://127.0.0.1:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(
  "/api/payments",
  express.urlencoded({ extended: false, limit: "16kb" }),
);
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-FreshCart-Service", "freshcart-api");
  res.set("Cache-Control", "private, no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !["/api/payments/ipn", "/api/payments/return"].includes(req.path)
  ) {
    const origin = req.get("Origin");
    if (
      origin &&
      origin !== (process.env.WEB_ORIGIN || "http://127.0.0.1:3000")
    )
      return res
        .status(403)
        .json({ message: "This request origin is not allowed." });
    if (!req.is("application/json"))
      return res.status(415).json({ message: "JSON requests are required." });
  }
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "freshcart-api", storage: databaseMode() }),
);
app.use("/api", accountRoutes);
app.use("/api", shoppingRoutes);
app.use("/api", adminRoutes);
app.get("/api/storefront", async (_req, res) => {
  const settings = await getSettings();
  const orders = await listOrders();
  const catalog = await getCatalog();
  const sales = new Map<string, number>();
  for (const order of orders.filter(
    (o) => o.mode === "mongodb" && !o.sandbox && o.status === "delivered",
  ))
    for (const item of order.items) {
      const id =
        catalog.find((p) => p.id === item.productId)?.parentId ||
        item.productId;
      sales.set(id, (sales.get(id) || 0) + item.quantity);
    }
  const reviews = (await listEntities<Review>("review:"))
    .filter((r) => r.status === "approved")
    .map(({ userId: _user, reference: _reference, ...r }) => r);
  res.json({
    settings,
    popularIds: [...sales].sort((a, b) => b[1] - a[1]).map(([id]) => id),
    reviews,
    storage: databaseMode(),
    payments: {
      enabled: paymentsEnabled(),
      sandbox: process.env.SSLCOMMERZ_LIVE !== "true",
    },
  });
});
app.get("/api/categories", async (_req, res) =>
  res.json({ categories: (await getSettings()).categories }),
);
app.get("/api/catalog", async (_req, res) =>
  res.json({ products: await getPublicCatalog() }),
);
const querySchema = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(60).optional(),
  brand: z.string().max(80).optional(),
  dietary: z.string().max(40).optional(),
  pack: z.string().max(60).optional(),
  includeVariants: z.enum(["true", "false"]).optional(),
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
  const q = querySchema.parse(req.query);
  res.json(
    filterProducts(await getPublicCatalog(), {
      ...q,
      includeVariants: q.includeVariants === "true",
      organic: q.organic === "true",
      offers: q.offers === "true",
    }),
  );
});
app.get("/api/products/:slug", async (req, res) => {
  const product = (await getCatalog()).find(
    (p) => p.active !== false && p.slug === req.params.slug,
  );
  if (!product) throw bad("Product not found.", 404);
  res.json({ product });
});
async function access(req: express.Request, reference: string) {
  const order = await findOrder(reference);
  const user = await currentUser(req);
  const token = req.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (
    !order ||
    !(
      tokenAccess(order, token) ||
      (user && (user.role === "admin" || order.userId === user.id))
    )
  )
    throw bad(
      "Order not found. Sign in or use the browser where you placed it.",
      404,
    );
  return order;
}
app.post("/api/orders", async (req, res) => {
  const input = orderSchema.parse(req.body);
  const user = await currentUser(req);
  await atomic(expirePending);
  const result = await placeOrder(input, user);
  let paymentUrl: string | undefined, paymentError: string | undefined;
  if (
    result.order.payment === "online" &&
    result.order.paymentStatus === "pending" &&
    result.order.status === "placed"
  )
    try {
      paymentUrl = await initiatePayment(result.order);
    } catch {
      paymentError =
        "The gateway session could not be confirmed. Check your order; unpaid reservations expire after 30 minutes.";
    }
  res.status(result.created ? 201 : 200).json({
    reference: result.order.reference,
    total: result.order.total,
    createdAt: result.order.createdAt,
    mode: result.order.mode,
    accessToken: input.accessToken,
    order: publicOrder(result.order),
    paymentUrl,
    paymentError,
  });
});
app.get("/api/orders/:reference", async (req, res) =>
  res.json({
    order: publicOrder(await access(req, req.params.reference as string)),
  }),
);
app.patch("/api/orders/:reference/address", async (req, res) => {
  const order = await access(req, req.params.reference as string);
  const customer = customerSchema.parse(req.body?.customer);
  if (
    !(await getSettings()).zones.some(
      (z) => z.name === customer.area && z.enabled,
    )
  )
    throw bad("Delivery is unavailable in this area.");
  if (order.customer.area !== customer.area)
    throw bad(
      "Contact the store to change delivery area after placing an order.",
    );
  const updated = await updateOrderAddress(order.reference, customer);
  if (!updated)
    throw bad(
      "Delivery details can only be changed before preparation begins.",
      409,
    );
  res.json({ order: publicOrder(updated) });
});
app.post("/api/orders/:reference/pay", async (req, res) => {
  await atomic(expirePending);
  const order = await access(req, req.params.reference as string);
  res.json({ paymentUrl: await initiatePayment(order) });
});
app.post("/api/orders/:reference/support", async (req, res) => {
  const order = await access(req, req.params.reference as string);
  const { message } = z
    .object({ message: z.string().trim().min(10).max(1000) })
    .parse(req.body);
  const ticket: SupportTicket = {
    id: randomUUID(),
    reference: order.reference,
    name: order.customer.name,
    message,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  await atomic(async () => {
    const existing = (await listEntities<SupportTicket>("support:")).filter(
      (t) => t.reference === order.reference && t.status === "open",
    );
    if (existing.length >= 3)
      throw bad(
        "You already have three open requests for this order. Please wait for the store to review them.",
        409,
      );
    await writeEntity(`support:${ticket.id}`, ticket);
  });
  res.status(201).json({
    id: ticket.id,
    message: "Your request has been saved for the store to review.",
  });
});
app.post("/api/payments/ipn", async (req, res) => {
  const { val_id } = z
    .object({ val_id: z.string().min(1).max(200) })
    .parse(req.body);
  await verifyPayment(val_id);
  res.json({ received: true });
});
app.all("/api/payments/return", async (req, res) => {
  const value = req.method === "GET" ? req.query : req.body;
  let order: OrderRecord | null = null;
  if (typeof value.val_id === "string" && value.val_id.length <= 200)
    try {
      order = await verifyPayment(value.val_id);
    } catch {}
  res.redirect(
    303,
    `${process.env.WEB_ORIGIN || "http://127.0.0.1:3000"}${order ? `/orders/${order.reference}` : "/orders?payment=unverified"}`,
  );
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
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
      return;
    }
    const status =
      Number((error as { status?: number }).status) ||
      (error instanceof SyntaxError ? 400 : 500);
    const expose = !!(error as { expose?: boolean }).expose;
    if (status >= 500 && !expose)
      console.error(
        "FreshCart request failed:",
        (error as { code?: string }).code || "internal_error",
      );
    res.status(status).json({
      message:
        (status < 500 || expose) && error instanceof Error
          ? error.message
          : "The service is temporarily unavailable. Please try again.",
    });
  },
);
