import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdmin, requireUser } from "./auth";
import {
  getCatalog,
  saveCatalog,
  getSettings,
  saveSettings,
  listOrders,
} from "./store";
import { atomic, listEntities, readEntity, writeEntity } from "./repository";
import { publicOrder, changeStatus, expirePending } from "./checkout";
import { productSchema, settingsSchema, bad } from "./validation";
import type { Review } from "../src/lib/storefront";
import type { SupportTicket } from "../src/lib/storefront";
export const adminRoutes = Router();
adminRoutes.use("/admin", async (req, _res, next) => {
  await requireAdmin(req);
  next();
});
adminRoutes.get("/admin/overview", async (_req, res) => {
  await atomic(expirePending);
  const orders = await listOrders(),
    catalog = await getCatalog();
  const delivered = orders.filter(
    (o) => o.status === "delivered" && o.mode === "mongodb" && !o.sandbox,
  );
  res.json({
    support: await listEntities<SupportTicket>("support:"),
    orders: orders.map(publicOrder),
    products: catalog,
    settings: await getSettings(),
    reviews: await listEntities<Review>("review:"),
    metrics: {
      orders: orders.length,
      revenue: delivered.reduce((s, o) => s + o.total, 0),
      delivered: delivered.length,
      pending: orders.filter(
        (o) => !["delivered", "cancelled"].includes(o.status),
      ).length,
      lowStock: catalog.filter((p) => p.active !== false && p.stock <= 5)
        .length,
    },
    storage: process.env.MONGODB_URI ? "mongodb" : "demo",
  });
});
adminRoutes.put("/admin/products/:id", async (req, res) => {
  const input = productSchema.parse(req.body);
  if (input.id !== req.params.id) throw bad("Product ID cannot change.");
  await atomic(async () => {
    const catalog = await getCatalog();
    if (catalog.some((p) => p.slug === input.slug && p.id !== input.id))
      throw bad("This product URL is already used.", 409);
    if (
      input.parentId &&
      !catalog.some((p) => p.id === input.parentId && !p.parentId)
    )
      throw bad("Choose an existing base product for this variant.");
    const old = catalog.find((p) => p.id === input.id);
    if (old && (old.version || 0) !== (input.version || 0))
      throw bad(
        "This product changed while you were editing. Refresh before saving.",
        409,
      );
    const item = {
      ...input,
      rating: 0,
      version: (old?.version || 0) + 1,
      createdAt: old ? old.createdAt : new Date().toISOString(),
    };
    await saveCatalog(
      old
        ? catalog.map((p) => (p.id === item.id ? item : p))
        : [...catalog, item],
    );
  });
  res.json({ ok: true });
});
adminRoutes.put("/admin/settings", async (req, res) => {
  const settings = settingsSchema.parse(req.body);
  await atomic(async () => {
    const catalog = await getCatalog();
    for (const bundle of settings.bundles)
      if (bundle.items.some((i) => !catalog.some((p) => p.id === i.productId)))
        throw bad(`Bundle ${bundle.name} references an unknown product.`);
    await saveSettings(settings);
  });
  res.json({ ok: true });
});
adminRoutes.patch("/admin/orders/:reference", async (req, res) => {
  const { status } = z
    .object({
      status: z.enum([
        "placed",
        "preparing",
        "out-for-delivery",
        "delivered",
        "cancelled",
      ]),
    })
    .parse(req.body);
  res.json({
    order: publicOrder(
      await changeStatus(req.params.reference as string, status),
    ),
  });
});
adminRoutes.patch("/admin/reviews/:id", async (req, res) => {
  const { status } = z
    .object({ status: z.enum(["approved", "rejected", "pending"]) })
    .parse(req.body);
  await atomic(async () => {
    const review = await readEntity<Review>(`review:${req.params.id}`);
    if (!review) throw bad("Review not found.", 404);
    await writeEntity(`review:${review.id}`, { ...review, status });
  });
  res.json({ ok: true });
});
adminRoutes.patch("/admin/support/:id", async (req, res) => {
  const { status } = z
    .object({ status: z.enum(["open", "resolved"]) })
    .parse(req.body);
  await atomic(async () => {
    const ticket = await readEntity<SupportTicket>(`support:${req.params.id}`);
    if (!ticket) throw bad("Support request not found.", 404);
    await writeEntity(`support:${ticket.id}`, { ...ticket, status });
  });
  res.json({ ok: true });
});
adminRoutes.get("/reviews", async (req, res) => {
  const { productId } = z
    .object({ productId: z.string().max(60).optional() })
    .parse(req.query);
  const reviews = (await listEntities<Review>("review:")).filter(
    (r) => r.status === "approved" && (!productId || r.productId === productId),
  );
  res.json({
    reviews: reviews.map(({ userId: _u, reference: _r, ...review }) => review),
  });
});
adminRoutes.post("/reviews", async (req, res) => {
  const user = await requireUser(req);
  const input = z
    .object({
      productId: z.string().max(60),
      reference: z.string().max(30),
      rating: z.number().int().min(1).max(5),
      text: z.string().trim().min(10).max(1000),
    })
    .parse(req.body);
  await atomic(async () => {
    const orders = await listOrders();
    const order = orders.find(
      (o) =>
        o.reference === input.reference &&
        o.userId === user.id &&
        o.status === "delivered" &&
        o.mode === "mongodb" &&
        !o.sandbox &&
        o.items.some((i) => i.productId === input.productId),
    );
    if (!order)
      throw bad(
        "Reviews are available after a real purchase is delivered.",
        403,
      );
    const existing = (await listEntities<Review>("review:")).find(
      (r) => r.userId === user.id && r.productId === input.productId,
    );
    if (existing)
      throw bad("You already submitted a review for this product.", 409);
    const review: Review = {
      ...input,
      id: randomUUID(),
      userId: user.id,
      author: user.name.split(" ")[0],
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await writeEntity(`review:${review.id}`, review);
  });
  res.status(201).json({
    message: "Thank you. Your verified purchase review is awaiting moderation.",
  });
});
