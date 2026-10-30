import { Router } from "express";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import {
  requirePermission,
  requireStaff,
  currentUser,
  publicUser,
  userById,
  saveUser,
  type UserRecord,
} from "./auth";
import { atomic, readEntity, writeEntity, listEntities } from "./repository";
import { getContent, getRecipes, audit, stockEvent } from "./management-store";
import { contentSchema, recipeSchema } from "./management-validation";
import { bad, productSchema } from "./validation";
import {
  getCatalog,
  saveCatalog,
  findOrder,
  listOrders,
  getSettings,
  saveSettings,
  replaceOrder,
} from "./store";
import { publicOrder, tokenAccess } from "./checkout";
import {
  can,
  salesReport,
  type AuditEvent,
  type StockEvent,
  type OrderOperations,
  type CaseMeta,
  type ReturnRequest,
} from "../src/lib/management";
import { searchProducts, normalizeSearch } from "../src/lib/search";
import type { Request } from "express";
import type { OrderRecord } from "../src/lib/orders";
import { validateContentLanguages } from "./content-language-validation";
import { getBatches } from "./inventory-store";
import { orderFinance, recordFinance } from "./finance-store";
export const managementRoutes = Router();
managementRoutes.get("/recipes", async (_req, res) =>
  res.json({ recipes: (await getRecipes()).filter((r) => r.active !== false) }),
);
managementRoutes.get("/recipes/:slug", async (req, res) => {
  const recipe = (await getRecipes()).find(
    (r) => r.slug === req.params.slug && r.active !== false,
  );
  if (!recipe) throw bad("Recipe not found.", 404);
  res.json({ recipe });
});
managementRoutes.get("/content", async (_req, res) =>
  res.json({ content: await getContent() }),
);
managementRoutes.get("/admin/content", async (req, res) => {
  await requirePermission(req, "content");
  res.json({ content: await getContent(), recipes: await getRecipes() });
});
managementRoutes.put("/admin/content", async (req, res) => {
  const actor = await requirePermission(req, "content"),
    input = contentSchema.parse(req.body);
  validateContentLanguages("homepage", input);
  const content = await atomic(async () => {
    const old = await getContent();
    if (old.version !== input.version)
      throw bad(
        "Homepage or search settings changed. Refresh before saving.",
        409,
      );
    const catalog = await getCatalog();
    if (
      input.aliases.some((a) =>
        a.productIds.some((id) => !catalog.some((p) => p.id === id)),
      )
    )
      throw bad("A search alias references an unknown SKU.");
    const next = { ...input, version: old.version + 1 };
    await writeEntity("content", next);
    const settings = await getSettings();
    await saveSettings({
      ...settings,
      homeSections: Object.fromEntries(
        Object.entries(settings.homeSections).map(([id, enabled]) => [
          id,
          next.sections.find((s) => s.id === id)?.enabled ?? enabled,
        ]),
      ) as typeof settings.homeSections,
    });
    await audit(
      actor,
      "content.updated",
      "homepage",
      "Homepage, search aliases and stock alert settings saved",
    );
    return next;
  });
  res.json({ content });
});
managementRoutes.put("/admin/recipes/:slug", async (req, res) => {
  const actor = await requirePermission(req, "content"),
    input = recipeSchema.parse(req.body);
  validateContentLanguages("recipe", input);
  if (input.slug !== req.params.slug) throw bad("Recipe slug cannot change.");
  const recipe = await atomic(async () => {
    const recipes = await getRecipes(),
      old = recipes.find((r) => r.slug === input.slug);
    if ((old?.version || 0) !== input.version)
      throw bad("Recipe changed. Refresh before saving.", 409);
    if (!old && recipes.length >= 100)
      throw bad("A maximum of 100 recipes is supported.");
    const catalog = await getCatalog();
    for (const ingredient of input.ingredients) {
      if (!ingredient.productId) continue;
      const p = catalog.find((p) => p.id === ingredient.productId);
      if (!p || p.measureUnit !== ingredient.measureUnit || !p.measure)
        throw bad(`Choose a measured product matching ${ingredient.name}.`);
    }
    const next = { ...input, version: (old?.version || 0) + 1 };
    await writeEntity(
      "recipes",
      old
        ? recipes.map((r) => (r.slug === next.slug ? next : r))
        : [...recipes, next],
    );
    await audit(
      actor,
      "recipe.saved",
      next.slug,
      next.active ? "Published recipe" : "Unpublished recipe",
    );
    return next;
  });
  res.json({ recipe });
});
managementRoutes.get("/admin/reports", async (req, res) => {
  await requirePermission(req, "reports");
  const q = z
    .object({
      days: z.coerce.number().int().min(1).max(90).default(7),
      mode: z.enum(["live", "demo"]).default("live"),
    })
    .parse(req.query);
  res.json({
    report: salesReport(
      (await listOrders()).map(publicOrder),
      q.days,
      q.mode,
      new Date(),
      (await getSettings()).profile.timeZone,
    ),
  });
});
managementRoutes.get("/admin/activity", async (req, res) => {
  await requirePermission(req, "audit");
  res.json({
    events: (await listEntities<AuditEvent>("audit:"))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 300),
  });
});
managementRoutes.get("/admin/inventory", async (req, res) => {
  await requirePermission(req, "products");
  const content = await getContent();
  res.json({
    threshold: content.lowStockThreshold,
    alerts: (await getCatalog()).filter(
      (p) =>
        p.active !== false &&
        p.stock <= (p.lowStockThreshold ?? content.lowStockThreshold),
    ),
    events: (await listEntities<StockEvent>("stock-event:"))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 300),
  });
});
managementRoutes.post("/admin/products/batch", async (req, res) => {
  const actor = await requirePermission(req, "products");
  const input = z
    .object({
      products: z.array(productSchema).min(1).max(100),
      reason: z.string().trim().min(3).max(200),
    })
    .parse(req.body);
  await atomic(async () => {
    const catalog = await getCatalog();
    if (new Set(input.products.map((p) => p.id)).size !== input.products.length)
      throw bad("Duplicate SKUs in batch.");
    let next = [...catalog];
    for (const p of input.products) {
      const old = catalog.find((v) => v.id === p.id);
      if ((old?.version || 0) !== (p.version || 0))
        throw bad(`${p.name} changed. Refresh and import again.`, 409);
      p.translations ??= old?.translations;
      validateContentLanguages("product", p);
      next = next
        .filter((v) => v.id !== p.id)
        .concat({
          ...p,
          rating: 0,
          version: (old?.version || 0) + 1,
          createdAt: old?.createdAt || new Date().toISOString(),
        });
      await stockEvent(actor, p.id, old?.stock || 0, p.stock, input.reason);
    }
    if (new Set(next.map((p) => p.slug)).size !== next.length)
      throw bad("Product URL slugs must be unique.");
    for (const p of next)
      if (p.parentId && !next.some((v) => v.id === p.parentId && !v.parentId))
        throw bad("A variant references an unknown base product.");
    await saveCatalog(next);
    await audit(
      actor,
      "products.batch",
      "catalog",
      `${input.products.length} SKUs: ${input.reason}`,
    );
  });
  res.json({ ok: true });
});
managementRoutes.post("/admin/products/preview", async (req, res) => {
  await requirePermission(req, "products");
  const { products } = z
    .object({ products: z.array(productSchema).min(1).max(100) })
    .parse(req.body);
  const catalog = await getCatalog();
  if (new Set(products.map((p) => p.id)).size !== products.length)
    throw bad("Duplicate SKUs in preview.");
  for (const product of products) {
    const old = catalog.find((p) => p.id === product.id);
    if ((old?.version || 0) !== (product.version || 0))
      throw bad(`${product.name} changed. Refresh and preview again.`, 409);
  }
  const combined = [
    ...catalog.filter((p) => !products.some((v) => v.id === p.id)),
    ...products,
  ];
  if (new Set(combined.map((p) => p.slug)).size !== combined.length)
    throw bad("Product URLs must be unique.");
  for (const p of combined)
    if (p.parentId && !combined.some((v) => v.id === p.parentId && !v.parentId))
      throw bad("A variant references an unknown base product.");
  res.json({ products });
});
managementRoutes.get("/admin/team", async (req, res) => {
  await requirePermission(req, "team");
  res.json({
    users: (await listEntities<UserRecord>("user:")).map(publicUser),
  });
});
managementRoutes.patch("/admin/team/:id", async (req, res) => {
  const actor = await requirePermission(req, "team"),
    input = z
      .object({
        role: z.enum(["customer", "admin", "manager", "editor", "fulfilment"]),
        expectedRole: z.enum([
          "customer",
          "admin",
          "manager",
          "editor",
          "fulfilment",
        ]),
      })
      .parse(req.body);
  await atomic(async () => {
    const user = await userById(req.params.id as string);
    if (!user) throw bad("Account not found.", 404);
    if (user.role !== input.expectedRole)
      throw bad("This role changed. Refresh before updating.", 409);
    if (
      user.role === "admin" &&
      input.role !== "admin" &&
      (await listEntities<UserRecord>("user:")).filter(
        (u) => u.role === "admin",
      ).length <= 1
    )
      throw bad("The last administrator cannot be removed.", 409);
    if (user.id === actor.id && input.role !== "admin")
      throw bad("Ask another administrator to change your own role.", 409);
    await saveUser({ ...user, role: input.role });
    await audit(actor, "team.role", user.id, `${user.role} → ${input.role}`);
  });
  res.json({ ok: true });
});
async function orderOperations(reference: string): Promise<OrderOperations> {
  return (
    (await readEntity<OrderOperations>(`order-ops:${reference}`)) || {
      reference,
      version: 0,
      notes: [],
    }
  );
}
managementRoutes.get(
  "/admin/orders/:reference/operations",
  async (req, res) => {
    await requirePermission(req, "orders");
    const reference = req.params.reference as string,
      order = await findOrder(reference);
    if (!order) throw bad("Order not found.", 404);
    res.json({
      operations: await orderOperations(reference),
      picking: (await getBatches()).flatMap((batch) => {
        const allocation = order.inventoryAllocations?.find(
          (a) => a.batchId === batch.id,
        );
        return allocation
          ? [
              {
                productId: batch.productId,
                batchNumber: batch.batchNumber,
                expiresOn: batch.expiresOn,
                quantity: allocation.quantity,
              },
            ]
          : [];
      }),
      events: (await listEntities<AuditEvent>("audit:"))
        .filter((e) => e.target === reference)
        .sort((a, b) => a.at.localeCompare(b.at)),
    });
  },
);
managementRoutes.post("/admin/orders/:reference/notes", async (req, res) => {
  const actor = await requirePermission(req, "orders"),
    input = z
      .object({
        text: z.string().trim().min(2).max(1000),
        version: z.number().int().nonnegative(),
      })
      .parse(req.body);
  await atomic(async () => {
    const reference = req.params.reference as string;
    if (!(await findOrder(reference))) throw bad("Order not found.", 404);
    const old = await orderOperations(reference);
    if (old.version !== input.version)
      throw bad("Order notes changed. Refresh first.", 409);
    await writeEntity(`order-ops:${reference}`, {
      ...old,
      version: old.version + 1,
      notes: [
        ...old.notes,
        {
          id: randomUUID(),
          text: input.text,
          actor: actor.name,
          at: new Date().toISOString(),
        },
      ],
    });
    await audit(actor, "order.note", reference, "Internal note added");
  });
  res.json({ ok: true });
});
managementRoutes.get("/admin/orders/:reference/print", async (req, res) => {
  await requirePermission(req, "orders");
  const order = await findOrder(req.params.reference as string);
  if (!order) throw bad("Order not found.", 404);
  res.json({ order: publicOrder(order) });
});
managementRoutes.get("/admin/cases", async (req, res) => {
  const user = await requireStaff(req);
  if (!can(user.role, "support") && !can(user.role, "reviews"))
    throw bad("Case access is required.", 403);
  res.json({
    cases: (await listEntities<CaseMeta>("case-meta:")).filter((c) =>
      can(user.role, c.id.startsWith("support:") ? "support" : "reviews"),
    ),
    staff: (await listEntities<UserRecord>("user:"))
      .filter((u) => can(u.role, "support") || can(u.role, "reviews"))
      .map((u) => ({ id: u.id, name: u.name, role: u.role })),
  });
});
managementRoutes.patch("/admin/cases/:kind/:id", async (req, res) => {
  const kind = z.enum(["support", "review"]).parse(req.params.kind),
    actor = await requirePermission(
      req,
      kind === "support" ? "support" : "reviews",
    ),
    input = z
      .object({
        version: z.number().int().nonnegative(),
        assigneeId: z.string().max(60),
        priority: z.enum(["low", "normal", "high"]),
      })
      .parse(req.body);
  const id = `${kind}:${req.params.id}`;
  await atomic(async () => {
    if (!(await readEntity(id))) throw bad("Case not found.", 404);
    const old = await readEntity<CaseMeta>(`case-meta:${id}`);
    if ((old?.version || 0) !== input.version)
      throw bad("Case changed. Refresh first.", 409);
    if (input.assigneeId) {
      const assignee = await userById(input.assigneeId);
      if (
        !assignee ||
        !can(assignee.role, kind === "support" ? "support" : "reviews")
      )
        throw bad("Choose staff with access to this case.");
    }
    await writeEntity(`case-meta:${id}`, {
      ...input,
      id,
      version: (old?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      resolvedAt: old?.resolvedAt,
    });
    await audit(
      actor,
      "case.assigned",
      id,
      `${input.priority} priority, assignee ${input.assigneeId || "unassigned"}`,
    );
  });
  res.json({ ok: true });
});
const missesRate = new Map<string, { count: number; expires: number }>();
managementRoutes.post("/search-misses", async (req, res) => {
  const { query } = z
    .object({ query: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const now = Date.now();
  for (const [k, v] of missesRate) if (v.expires < now) missesRate.delete(k);
  const ip = req.ip || "local",
    entry = missesRate.get(ip) || { count: 0, expires: now + 60000 };
  if (++entry.count > 20 || missesRate.size > 1000)
    throw bad("Please search again in a moment.", 429);
  missesRate.set(ip, entry);
  const normalized = normalizeSearch(query);
  const { getPublicCatalog } = await import("./store");
  if (searchProducts(await getPublicCatalog(), normalized).length)
    return res.json({ ok: true });
  await atomic(async () => {
    const key = `search-miss:${createHash("sha256").update(normalized).digest("hex")}`,
      old = await readEntity<{ query: string; count: number; lastAt: string }>(
        key,
      );
    await writeEntity(key, {
      query: normalized,
      count: (old?.count || 0) + 1,
      lastAt: new Date().toISOString(),
    });
  });
  res.json({ ok: true });
});
managementRoutes.get("/admin/search-misses", async (req, res) => {
  await requirePermission(req, "content");
  res.json({
    misses: (
      await listEntities<{ query: string; count: number; lastAt: string }>(
        "search-miss:",
      )
    )
      .sort((a, b) => b.count - a.count)
      .slice(0, 100),
  });
});
managementRoutes.post("/admin/media", async (req, res) => {
  const actor = await requirePermission(req, "products").catch(async () =>
    requirePermission(req, "content"),
  );
  const input = z
    .object({
      data: z.string().max(2800000),
      mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
    })
    .parse(req.body);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))
    throw bad("Invalid image data.");
  const bytes = Buffer.from(input.data, "base64");
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 16)
    throw bad("Images must be between 16 bytes and 2 MB.");
  const valid =
    input.mime === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : input.mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw bad("Image type does not match its contents.");
  const id = `${randomUUID()}.${input.mime === "image/png" ? "png" : input.mime === "image/jpeg" ? "jpg" : "webp"}`;
  await atomic(async () => {
    await writeEntity(`media:${id}`, input);
    await audit(actor, "image.uploaded", id, "Image uploaded");
  });
  res.status(201).json({ url: `/api/media/${id}` });
});
managementRoutes.get("/media/:id", async (req, res) => {
  if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(req.params.id as string))
    throw bad("Image not found.", 404);
  const media = await readEntity<{ mime: string; data: string }>(
    `media:${req.params.id}`,
  );
  if (!media) throw bad("Image not found.", 404);
  res
    .type(media.mime)
    .set("Content-Security-Policy", "default-src 'none'")
    .send(Buffer.from(media.data, "base64"));
});

async function returnAccess(req: Request): Promise<OrderRecord> {
  const order = await findOrder(req.params.reference as string),
    user = await currentUser(req),
    token = req.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (
    !order ||
    !(
      (order.userId && order.userId === user?.id) ||
      can(user?.role, "returns") ||
      tokenAccess(order, token)
    )
  )
    throw bad("Order not found.", 404);
  return order;
}
const customerReturn = (r: ReturnRequest) => ({
  id: r.id,
  reference: r.reference,
  reason: r.reason,
  items: r.items,
  amount: r.amount,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});
managementRoutes.get("/orders/:reference/returns", async (req, res) => {
  const order = await returnAccess(req);
  res.json({
    returns: (await listEntities<ReturnRequest>("return:"))
      .filter((r) => r.reference === order.reference)
      .map(customerReturn),
  });
});
managementRoutes.post("/orders/:reference/returns", async (req, res) => {
  const order = await returnAccess(req),
    input = z
      .object({
        reason: z.string().trim().min(10).max(1000),
        items: z
          .array(
            z.object({
              productId: z.string().max(60),
              quantity: z.number().int().min(1).max(100),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(req.body);
  if (order.status !== "delivered")
    throw bad("Returns can be requested after delivery.");
  const result = await atomic(async () => {
    if (
      new Set(input.items.map((i) => i.productId)).size !== input.items.length
    )
      throw bad("Duplicate returned products.");
    const prior = (await listEntities<ReturnRequest>("return:")).filter(
      (r) => r.reference === order.reference && r.status !== "rejected",
    );
    let value = 0;
    for (const item of input.items) {
      const original = order.items.find((i) => i.productId === item.productId),
        reserved = prior
          .flatMap((r) => r.items)
          .filter((i) => i.productId === item.productId)
          .reduce((n, i) => n + i.quantity, 0);
      if (!original || reserved + item.quantity > original.quantity)
        throw bad("Returned quantity exceeds purchased packs.", 409);
      value += original.price * item.quantity;
    }
    const amount =
        Math.floor(
          value *
            (order.subtotal ? 1 - order.discount / order.subtotal : 0) *
            100,
        ) / 100,
      now = new Date().toISOString(),
      r: ReturnRequest = {
        id: randomUUID(),
        reference: order.reference,
        userId: order.userId,
        name: order.customer.name,
        reason: input.reason,
        items: input.items,
        amount,
        status: "requested",
        version: 1,
        createdAt: now,
        updatedAt: now,
        restocked: false,
        notes: "",
        history: [{ status: "requested", at: now, actor: "Customer" }],
      };
    await writeEntity(`return:${r.id}`, r);
    await audit(undefined, "return.requested", order.reference, r.id);
    return r;
  });
  res.status(201).json({ return: customerReturn(result) });
});
managementRoutes.get("/admin/returns", async (req, res) => {
  await requirePermission(req, "returns");
  res.json({
    returns: (await listEntities<ReturnRequest>("return:")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  });
});
managementRoutes.patch("/admin/returns/:id", async (req, res) => {
  const actor = await requirePermission(req, "returns"),
    input = z
      .object({
        version: z.number().int().positive(),
        status: z.enum([
          "approved",
          "received",
          "refund-pending",
          "refunded",
          "rejected",
        ]),
        restock: z.boolean().default(false),
        notes: z.string().trim().min(3).max(1000),
        refundMethod: z.string().trim().max(80).optional(),
        refundReference: z.string().trim().max(120).optional(),
      })
      .parse(req.body);
  const result = await atomic(async () => {
    const old = await readEntity<ReturnRequest>(`return:${req.params.id}`);
    if (!old) throw bad("Return request not found.", 404);
    if (old.version !== input.version)
      throw bad("Return changed. Refresh first.", 409);
    const transitions: Record<string, string[]> = {
      requested: ["approved", "rejected"],
      approved: ["received", "refund-pending", "rejected"],
      received: ["refund-pending"],
      "refund-pending": ["refunded"],
    };
    if (!transitions[old.status]?.includes(input.status))
      throw bad("This return transition is not allowed.", 409);
    if (
      input.status === "refunded" &&
      (!input.refundMethod || !input.refundReference)
    )
      throw bad(
        "Record the completed payment method and external refund reference.",
      );
    if (input.status === "refunded") {
      await requirePermission(req, "finance");
      const source = await findOrder(old.reference);
      if (!source) throw bad("Order not found.", 404);
      const finance = await orderFinance(source);
      await recordFinance(
        source,
        {
          id: old.id,
          kind: "refund",
          amount: old.amount,
          method: input.refundMethod!,
          reference: input.refundReference!,
          note: input.notes,
          returnId: old.id,
        },
        finance.version,
        actor,
      );
      await replaceOrder({
        ...source,
        financeRevision: (source.financeRevision || 0) + 1,
      });
    }
    if (input.restock && input.status !== "received")
      throw bad("Restock only when receiving inspected items.");
    if (input.restock && !old.restocked) {
      const sourceOrder = await findOrder(old.reference);
      if (
        sourceOrder?.inventoryAllocations?.some((a) =>
          old.items.some((i) => i.productId === a.productId),
        )
      )
        throw bad(
          "Receive these inspected batch-tracked returns as a new dated batch in Suppliers & batches. Leave automatic restock unchecked.",
        );
      const catalog = await getCatalog();
      for (const item of old.items) {
        const p = catalog.find((p) => p.id === item.productId);
        if (!p || p.stock + item.quantity > 100000)
          throw bad(
            "Returned items cannot be restocked into the current catalog.",
          );
        await stockEvent(
          actor,
          p.id,
          p.stock,
          p.stock + item.quantity,
          `Inspected return ${old.id}`,
        );
        p.stock += item.quantity;
        p.version = (p.version || 0) + 1;
      }
      await saveCatalog(catalog);
    }
    const now = new Date().toISOString(),
      next: ReturnRequest = {
        ...old,
        status: input.status,
        version: old.version + 1,
        updatedAt: now,
        notes: input.notes,
        restocked: old.restocked || input.restock,
        refundMethod: input.refundMethod || old.refundMethod,
        refundReference: input.refundReference || old.refundReference,
        history: [
          ...old.history,
          { status: input.status, at: now, actor: actor.name },
        ],
      };
    await writeEntity(`return:${old.id}`, next);
    await audit(
      actor,
      "return.status",
      old.reference,
      `${old.id}: ${old.status} → ${input.status}`,
    );
    return next;
  });
  res.json({ return: result });
});
