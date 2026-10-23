import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { app } from "../server/app";
import { atomic, readEntity, writeEntity } from "../server/repository";
import { userByEmail, saveUser, type UserRecord } from "../server/auth";
import { getCatalog, replaceOrder } from "../server/store";
import { placeOrder } from "../server/checkout";
import { deliveryDays, type Order } from "../src/lib/orders";
import {
  defaultContent,
  salesReport,
  type ContentConfig,
  type ReturnRequest,
  type CaseMeta,
} from "../src/lib/management";
import { recipes, type Recipe } from "../src/lib/recipes";
import {
  exportProducts,
  importProducts,
  parseCsv,
} from "../src/lib/product-csv";
import { products } from "../src/lib/catalog";

test("CSV round trips quoted multiline fields and rejects unsafe updates", () => {
  const source = {
    ...products[0],
    name: 'Banana, "Local"',
    description: 'Two lines\nwith commas, and quotes "yes"',
    searchTerms: ["কলা", "kola"],
    version: 2,
  };
  const csv = exportProducts([source]),
    result = importProducts(csv, [source]);
  assert.equal(result[0].name, source.name);
  assert.equal(result[0].description, source.description);
  assert.deepEqual(result[0].searchTerms, source.searchTerms);
  assert.equal(result[0].version, 2);
  assert.throws(
    () => importProducts("id,stock\nbanana,3", [source]),
    /version/,
  );
  assert.throws(() => parseCsv('id,name\na,"broken'), /Unclosed/);
  assert.throws(() => parseCsv('id,price\nbanana,"1"0'), /closing CSV quote/);
  assert.throws(
    () => importProducts("id,version,stock\nbanana,2,NaN", [source]),
    /invalid stock/,
  );
  assert.ok(
    exportProducts([{ ...source, name: '=HYPERLINK("bad")' }]).includes(
      "'=HYPERLINK",
    ),
  );
});
test("sales reports distinguish demo, unsettled online orders and Dhaka period boundaries", () => {
  const base = {
    ...({} as Order),
    reference: "FC-AAAA00000000",
    createdAt: "2026-10-21T03:00:00Z",
    mode: "mongodb" as const,
    status: "delivered" as const,
    payment: "cash-on-delivery" as const,
    total: 100,
    discount: 10,
    promoCode: "FRESH10",
  };
  const report = salesReport(
    [
      base,
      { ...base, mode: "demo", total: 999 },
      { ...base, payment: "online", paymentStatus: "pending", total: 888 },
      { ...base, createdAt: "2026-10-19T18:00:00Z", total: 80 },
    ],
    1,
    "live",
    new Date("2026-10-21T10:00:00Z"),
  );
  assert.equal(report.current.orders, 2);
  assert.equal(report.current.revenue, 100);
  assert.equal(report.previous.revenue, 80);
  assert.equal(report.daily[0].date, "2026-10-21");
  assert.equal(report.promos[0].discount, 10);
  assert.equal(
    salesReport(
      [{ ...base, mode: "demo", total: 999 }],
      1,
      "demo",
      new Date("2026-10-21T10:00:00Z"),
    ).current.revenue,
    999,
  );
});
test("management API: content, recipes, staff boundaries, stock history and returns", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-management-"));
  process.env.FRESHCART_DATA_DIR = directory;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
    delete process.env.FRESHCART_DATA_DIR;
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  async function request(
    path: string,
    body?: unknown,
    cookie = "",
    method = body === undefined ? "GET" : "POST",
    extra: Record<string, string> = {},
  ) {
    return fetch(base + path, {
      method,
      headers: {
        ...extra,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  const sessions: Record<string, string> = {},
    users: Record<string, UserRecord> = {};
  for (const role of [
    "admin",
    "manager",
    "editor",
    "fulfilment",
    "customer",
    "other",
  ] as const) {
    const email = `${role}@management.example.test`,
      response = await request("/auth/register", {
        name: `Test ${role}`,
        email,
        password: "Management-test-123",
      });
    assert.equal(response.status, 201);
    sessions[role] = response.headers.get("set-cookie")!.split(";")[0];
    const user = (await userByEmail(email))!;
    users[role] = user;
    if (!["customer", "other"].includes(role))
      await atomic(() =>
        saveUser({
          ...user,
          role: role as "admin" | "manager" | "editor" | "fulfilment",
        }),
      );
  }
  let content: ContentConfig = structuredClone(defaultContent);
  let reference = "",
    returnId = "",
    version = 1;
  await t.test(
    "server permissions cover legacy and new endpoints without exposing customer records to editors",
    async () => {
      assert.equal((await request("/admin/content")).status, 401);
      assert.equal(
        (await request("/admin/content", undefined, sessions.customer)).status,
        403,
      );
      assert.equal(
        (await request("/admin/content", undefined, sessions.editor)).status,
        200,
      );
      assert.equal(
        (await request("/admin/reports", undefined, sessions.editor)).status,
        403,
      );
      assert.equal(
        (await request("/admin/team", undefined, sessions.manager)).status,
        403,
      );
      assert.equal(
        (await request("/admin/settings", {}, sessions.fulfilment, "PUT"))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            "/admin/products/banana",
            products[0],
            sessions.fulfilment,
            "PUT",
          )
        ).status,
        403,
      );
      assert.deepEqual(
        (
          await (
            await request("/admin/overview", undefined, sessions.editor)
          ).json()
        ).orders,
        [],
      );
    },
  );
  await t.test(
    "homepage edits, alias matching and stale versions are enforced",
    async () => {
      content = (
        await (
          await request("/admin/content", undefined, sessions.editor)
        ).json()
      ).content;
      content.hero.title = "A fresh market for every day";
      content.aliases = [{ term: "লাল ফল", productIds: ["apple"] }];
      content.sections = [...content.sections].reverse();
      const saved = await request(
        "/admin/content",
        content,
        sessions.editor,
        "PUT",
      );
      assert.equal(saved.status, 200);
      const stale = structuredClone(content);
      content = (await saved.json()).content;
      assert.equal(
        (await request("/admin/content", stale, sessions.editor, "PUT")).status,
        409,
      );
      assert.equal(
        (
          await request(
            "/admin/content",
            {
              ...content,
              hero: { ...content.hero, href: "javascript:alert(1)" },
            },
            sessions.editor,
            "PUT",
          )
        ).status,
        400,
      );
      assert.equal(
        (await (await request("/content")).json()).content.hero.title,
        content.hero.title,
      );
      const found = await (
        await request(`/products?q=${encodeURIComponent("লাল ফল")}`)
      ).json();
      assert.equal(found.products[0].id, "apple");
      assert.equal(
        (
          await request(
            "/admin/content",
            {
              ...content,
              sections: content.sections.map(() => content.sections[0]),
            },
            sessions.editor,
            "PUT",
          )
        ).status,
        400,
      );
    },
  );
  await t.test(
    "recipes persist, validate measured products, reject conflicting edits and unpublish from the public API",
    async () => {
      const recipe: Recipe = {
        ...recipes[0],
        slug: "qa-meal",
        title: "A QA meal",
        version: 0,
        active: true,
      };
      assert.equal(
        (
          await request(
            "/admin/recipes/qa-meal",
            {
              ...recipe,
              ingredients: [
                {
                  id: "bad",
                  name: "Unknown",
                  productId: "not-a-product",
                  amount: 1,
                  measureUnit: "kg",
                },
              ],
            },
            sessions.editor,
            "PUT",
          )
        ).status,
        400,
      );
      const response = await request(
        "/admin/recipes/qa-meal",
        recipe,
        sessions.editor,
        "PUT",
      );
      assert.equal(response.status, 200);
      const saved = (await response.json()).recipe;
      assert.equal((await request("/recipes/qa-meal")).status, 200);
      assert.equal(
        (
          await request(
            "/admin/recipes/qa-meal",
            recipe,
            sessions.editor,
            "PUT",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "/admin/recipes/qa-meal",
            { ...saved, active: false },
            sessions.editor,
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal((await request("/recipes/qa-meal")).status, 404);
    },
  );
  await t.test(
    "image uploads reject script/type mismatches and serve authenticated uploads without exposing private entities",
    async () => {
      assert.equal(
        (
          await request(
            "/admin/media",
            {
              mime: "image/png",
              data: Buffer.from("<script>alert(1)</script>").toString("base64"),
            },
            sessions.editor,
          )
        ).status,
        400,
      );
      const png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqN8AAAAASUVORK5CYII=";
      const response = await request(
        "/admin/media",
        { mime: "image/png", data: png },
        sessions.editor,
      );
      assert.equal(response.status, 201);
      const { url } = await response.json(),
        served = await fetch(base.replace(/\/api$/, "") + url);
      assert.equal(served.status, 200);
      assert.match(served.headers.get("content-type")!, /image\/png/);
      assert.equal((await request("/media/catalog")).status, 404);
      assert.equal(
        (
          await request(
            "/admin/media",
            { mime: "image/png", data: png },
            sessions.customer,
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "bulk previews do not mutate stock and batch updates are atomic, versioned and audited",
    async () => {
      let catalog = await getCatalog();
      const banana = catalog.find((p) => p.id === "banana")!,
        milk = catalog.find((p) => p.id === "milk")!,
        next = { ...banana, stock: banana.stock + 4 };
      assert.equal(
        (
          await request(
            "/admin/products/preview",
            { products: [next] },
            sessions.editor,
          )
        ).status,
        200,
      );
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        banana.stock,
      );
      assert.equal(
        (
          await request(
            "/admin/products/batch",
            {
              products: [next, { ...milk, version: 999 }],
              reason: "Test delivery",
            },
            sessions.editor,
          )
        ).status,
        409,
      );
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        banana.stock,
      );
      assert.equal(
        (
          await request(
            "/admin/products/batch",
            { products: [next], reason: "Test supplier delivery" },
            sessions.editor,
          )
        ).status,
        200,
      );
      catalog = await getCatalog();
      assert.equal(
        catalog.find((p) => p.id === "banana")!.stock,
        banana.stock + 4,
      );
      assert.equal(
        (
          await request(
            "/admin/products/batch",
            { products: [next], reason: "Replay stale changes" },
            sessions.editor,
          )
        ).status,
        409,
      );
      const inventory = await (
        await request("/admin/inventory", undefined, sessions.editor)
      ).json();
      assert.equal(inventory.events[0].reason, "Test supplier delivery");
    },
  );
  await t.test(
    "order history, notes and print endpoints enforce ownership and staff access",
    async () => {
      const { order } = await placeOrder(
        {
          customer: {
            name: "Order Tester",
            phone: "01712345678",
            address: "Private test address in Dhanmondi",
            area: "Dhanmondi",
          },
          items: [{ productId: "milk", quantity: 2 }],
          deliverySelection: {
            date: deliveryDays()[1].date,
            slot: "afternoon",
          },
          payment: "cash-on-delivery",
          instructions: "Test only",
          promo: "FRESH10",
          requestId: randomUUID(),
          accessToken: randomUUID(),
          acceptedTerms: true,
        },
        users.customer,
      );
      reference = order.reference;
      assert.equal(order.promoCode, "FRESH10");
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}/print`,
            undefined,
            sessions.editor,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}/print`,
            undefined,
            sessions.fulfilment,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request(`/orders/${reference}`, undefined, sessions.editor))
          .status,
        404,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}/notes`,
            { text: "Pack the milk carefully", version: 0 },
            sessions.fulfilment,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}/notes`,
            { text: "Stale note", version: 0 },
            sessions.fulfilment,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            `/orders/${reference}/returns`,
            {
              reason: "The cartons arrived damaged.",
              items: [{ productId: "milk", quantity: 1 }],
            },
            sessions.customer,
          )
        ).status,
        400,
      );
      for (const status of ["preparing", "out-for-delivery", "delivered"])
        assert.equal(
          (
            await request(
              `/admin/orders/${reference}`,
              { status },
              sessions.fulfilment,
              "PATCH",
            )
          ).status,
          200,
        );
      const details = await (
        await request(
          `/admin/orders/${reference}/operations`,
          undefined,
          sessions.fulfilment,
        )
      ).json();
      assert.equal(details.operations.notes.length, 1);
      assert.equal(
        details.events.filter(
          (e: { action: string }) => e.action === "order.status",
        ).length,
        3,
      );
      assert.equal(
        (
          await (
            await request(`/orders/${reference}`, undefined, sessions.customer)
          ).json()
        ).order.notes,
        undefined,
      );
    },
  );
  await t.test(
    "returns cannot exceed purchased packs, disclose another order or restock twice; refunds require payment evidence",
    async () => {
      const payload = {
        reason: "The carton was damaged upon arrival.",
        items: [{ productId: "milk", quantity: 1 }],
      };
      assert.equal(
        (await request(`/orders/${reference}/returns`, payload, sessions.other))
          .status,
        404,
      );
      assert.equal(
        (
          await request(
            `/orders/${reference}/returns`,
            { ...payload, items: [{ productId: "milk", quantity: 3 }] },
            sessions.customer,
          )
        ).status,
        409,
      );
      const response = await request(
        `/orders/${reference}/returns`,
        payload,
        sessions.customer,
      );
      assert.equal(response.status, 201);
      const returned = (await response.json()).return;
      returnId = returned.id;
      assert.equal(returned.amount, 72);
      assert.equal(returned.notes, undefined);
      const before = (await getCatalog()).find((p) => p.id === "milk")!.stock;
      async function update(
        status: string,
        extra: Record<string, unknown> = {},
      ) {
        return request(
          `/admin/returns/${returnId}`,
          {
            version,
            status,
            notes: "Test inspection and resolution",
            ...extra,
          },
          sessions.manager,
          "PATCH",
        );
      }
      assert.equal((await update("refunded")).status, 409);
      let result = await update("approved");
      assert.equal(result.status, 200);
      version = (await result.json()).return.version;
      result = await update("received", { restock: true });
      assert.equal(result.status, 200);
      version = (await result.json()).return.version;
      assert.equal(
        (await getCatalog()).find((p) => p.id === "milk")!.stock,
        before + 1,
      );
      assert.equal((await update("received", { restock: true })).status, 409);
      result = await update("refund-pending");
      assert.equal(result.status, 200);
      version = (await result.json()).return.version;
      assert.equal((await update("refunded")).status, 400);
      result = await update("refunded", {
        refundMethod: "Test cash receipt",
        refundReference: "QA-REFUND-001",
      });
      assert.equal(result.status, 200);
      version = (await result.json()).return.version;
      assert.equal(
        (await getCatalog()).find((p) => p.id === "milk")!.stock,
        before + 1,
      );
      assert.equal(
        (
          await update("refunded", {
            refundMethod: "Cash",
            refundReference: "Replay",
          })
        ).status,
        409,
      );
      const privateResult = await (
        await request(
          `/orders/${reference}/returns`,
          undefined,
          sessions.customer,
        )
      ).json();
      assert.equal(privateResult.returns[0].refundReference, undefined);
      assert.equal(
        (
          await request(
            `/orders/${reference}/returns`,
            { ...payload, items: [{ productId: "milk", quantity: 2 }] },
            sessions.customer,
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "case assignment validates staff capability and records resolution times",
    async () => {
      await atomic(() =>
        writeEntity("support:test-ticket", {
          id: "test-ticket",
          reference,
          name: "Tester",
          message: "Help with this test order.",
          status: "open",
          createdAt: new Date(Date.now() - 60000).toISOString(),
        }),
      );
      assert.equal(
        (
          await request(
            "/admin/cases/support/test-ticket",
            { version: 0, priority: "high", assigneeId: users.editor.id },
            sessions.fulfilment,
            "PATCH",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/admin/cases/support/test-ticket",
            { version: 0, priority: "high", assigneeId: users.fulfilment.id },
            sessions.fulfilment,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/admin/support/test-ticket",
            { status: "resolved" },
            sessions.fulfilment,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.ok(
        (await readEntity<CaseMeta>("case-meta:support:test-ticket"))
          ?.resolvedAt,
      );
    },
  );
  await t.test(
    "role changes are administrator-only and customer registration cannot escalate",
    async () => {
      assert.equal(
        (
          await request(
            `/admin/team/${users.other.id}`,
            { expectedRole: "customer", role: "manager" },
            sessions.manager,
            "PATCH",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/admin/team/${users.admin.id}`,
            { expectedRole: "admin", role: "customer" },
            sessions.admin,
            "PATCH",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            `/admin/team/${users.other.id}`,
            { expectedRole: "customer", role: "editor" },
            sessions.admin,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/admin/content", undefined, sessions.other)).status,
        200,
      );
      assert.equal(
        (await request("/admin/team", undefined, sessions.other)).status,
        403,
      );
      const team = await (
        await request("/admin/team", undefined, sessions.admin)
      ).json();
      assert.ok(
        team.users.every(
          (u: Record<string, unknown>) =>
            !("passwordHash" in u) && !("cart" in u),
        ),
      );
    },
  );
  await t.test(
    "unmatched searches are aggregated without account identifiers and staff actions are auditable",
    async () => {
      const query = "missing-vegetable";
      assert.equal((await request("/search-misses", { query })).status, 200);
      assert.equal((await request("/search-misses", { query })).status, 200);
      const data = await (
        await request("/admin/search-misses", undefined, sessions.editor)
      ).json();
      assert.equal(data.misses[0].count, 2);
      assert.equal(data.misses[0].userId, undefined);
      const events = await (
        await request("/admin/activity", undefined, sessions.manager)
      ).json();
      assert.ok(
        events.events.some(
          (e: { action: string }) => e.action === "recipe.saved",
        ),
      );
      assert.equal(
        (await request("/admin/activity", undefined, sessions.editor)).status,
        403,
      );
    },
  );
});
