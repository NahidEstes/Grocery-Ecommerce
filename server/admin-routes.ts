import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requirePermission, requireStaff, requireUser } from "./auth";
import { can, type Permission } from "../src/lib/management";
import { audit, stockEvent, getContent } from "./management-store";
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
import { validateContentLanguages } from "./content-language-validation";
export const adminRoutes = Router();
adminRoutes.use("/admin", async (req, _res, next) => {
  if (req.method === "GET" && req.path === "/overview") await requireStaff(req);
  else {
    const group = req.path.split("/")[1];
    const permission = (
      {
        products: "products",
        settings: "content",
        orders: "orders",
        reviews: "reviews",
        support: "support",
      } as Record<string, Permission>
    )[group];
    if (!permission) await requireStaff(req);
    else await requirePermission(req, permission);
  }
  next();
});
adminRoutes.get("/admin/overview", async (req, res) => {
  const actor = await requireStaff(req),
    content = await getContent();
  await atomic(expirePending);
  const orders = await listOrders(),
    catalog = await getCatalog();
  const delivered = orders.filter(
    (o) => o.status === "delivered" && o.mode === "mongodb" && !o.sandbox,
  );
  res.json({
    stockThreshold: content.lowStockThreshold,
    support: can(actor.role, "support")
      ? await listEntities<SupportTicket>("support:")
      : [],
    orders:
      can(actor.role, "orders") || can(actor.role, "reports")
        ? orders.map(publicOrder)
        : [],
    products: catalog,
    settings: await getSettings(),
    reviews: can(actor.role, "reviews")
      ? await listEntities<Review>("review:")
      : [],
    metrics: {
      orders: can(actor.role, "reports") ? orders.length : 0,
      revenue: can(actor.role, "reports")
        ? delivered.reduce((s, o) => s + o.total, 0)
        : 0,
      delivered: can(actor.role, "reports") ? delivered.length : 0,
      pending: can(actor.role, "reports")
        ? orders.filter((o) => !["delivered", "cancelled"].includes(o.status))
            .length
        : 0,
      lowStock: catalog.filter(
        (p) =>
          p.active !== false &&
          p.stock <= (p.lowStockThreshold ?? content.lowStockThreshold),
      ).length,
    },
    storage: process.env.MONGODB_URI ? "mongodb" : "demo",
  });
});
adminRoutes.put("/admin/products/:id", async (req, res) => {
  const actor = await requirePermission(req, "products");
  const input = productSchema.parse(req.body);
  const reason =
    z
      .string()
      .trim()
      .min(3)
      .max(200)
      .optional()
      .parse(req.body.changeReason || undefined) ||
    "Product editor stock adjustment";
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
      translations: input.translations ?? old?.translations,
      rating: 0,
      version: (old?.version || 0) + 1,
      createdAt: old ? old.createdAt : new Date().toISOString(),
    };
    validateContentLanguages("product", item);
    await stockEvent(actor, item.id, old?.stock || 0, item.stock, reason);
    await saveCatalog(
      old
        ? catalog.map((p) => (p.id === item.id ? item : p))
        : [...catalog, item],
    );
    await audit(
      actor,
      "product.saved",
      item.id,
      old ? "Product updated" : "Product created",
    );
  });
  res.json({ ok: true });
});
adminRoutes.put("/admin/settings", async (req, res) => {
  const actor = await requirePermission(req, "content");
  const settings = settingsSchema.parse(req.body);
  await atomic(async () => {
    const catalog = await getCatalog();
    for (const bundle of settings.bundles)
      if (bundle.items.some((i) => !catalog.some((p) => p.id === i.productId)))
        throw bad(`Bundle ${bundle.name} references an unknown product.`);
    if (!req.body.profile) settings.profile = (await getSettings()).profile;
    if (
      process.env.SSLCOMMERZ_STORE_ID &&
      (settings.profile.currency !== "BDT" || settings.profile.country !== "BD")
    )
      throw bad(
        "The configured SSLCOMMERZ adapter requires currency BDT and country BD. Remove gateway configuration before changing market.",
      );
    const oldProfile = (await getSettings()).profile;
    if (
      oldProfile.currency !== settings.profile.currency &&
      (await listOrders()).length > 0
    )
      throw bad(
        "Currency is locked after the first order to protect historical totals and reports. Start a fresh store database to change currency.",
        409,
      );
    await saveSettings(settings);
    const content = await getContent();
    await writeEntity("content", {
      ...content,
      version: content.version + 1,
      sections: content.sections.map((s) => ({
        ...s,
        enabled:
          s.id in settings.homeSections
            ? settings.homeSections[s.id as keyof typeof settings.homeSections]
            : s.enabled,
      })),
    });
    await audit(
      actor,
      "settings.updated",
      "storefront",
      "Storefront settings saved",
    );
  });
  res.json({ ok: true });
});
adminRoutes.patch("/admin/orders/:reference", async (req, res) => {
  const actor = await requirePermission(req, "orders");
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
      await changeStatus(req.params.reference as string, status, actor),
    ),
  });
});
adminRoutes.patch("/admin/reviews/:id", async (req, res) => {
  const actor = await requirePermission(req, "reviews");
  const { status } = z
    .object({ status: z.enum(["approved", "rejected", "pending"]) })
    .parse(req.body);
  await atomic(async () => {
    const review = await readEntity<Review>(`review:${req.params.id}`);
    if (!review) throw bad("Review not found.", 404);
    await writeEntity(`review:${review.id}`, { ...review, status });
    const key = `case-meta:review:${review.id}`,
      old = await readEntity<Record<string, unknown>>(key);
    await writeEntity(key, {
      id: `review:${review.id}`,
      assigneeId: "",
      priority: "normal",
      ...old,
      version: Number(old?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      resolvedAt: status === "pending" ? undefined : new Date().toISOString(),
    });
    await audit(actor, "review.status", review.id, status);
  });
  res.json({ ok: true });
});
adminRoutes.patch("/admin/support/:id", async (req, res) => {
  const actor = await requirePermission(req, "support");
  const { status } = z
    .object({ status: z.enum(["open", "resolved"]) })
    .parse(req.body);
  await atomic(async () => {
    const ticket = await readEntity<SupportTicket>(`support:${req.params.id}`);
    if (!ticket) throw bad("Support request not found.", 404);
    await writeEntity(`support:${ticket.id}`, { ...ticket, status });
    const key = `case-meta:support:${ticket.id}`,
      old = await readEntity<Record<string, unknown>>(key);
    await writeEntity(key, {
      id: `support:${ticket.id}`,
      assigneeId: "",
      priority: "normal",
      ...old,
      version: Number(old?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
    });
    await audit(actor, "support.status", ticket.id, status);
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
