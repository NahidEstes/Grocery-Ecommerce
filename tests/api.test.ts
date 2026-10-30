import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { app } from "../server/app";
import { deliveryDays } from "../src/lib/orders";
import { findOrder, replaceOrder, getCatalog } from "../server/store";
import { userByEmail, saveUser, digest } from "../server/auth";
import { atomic } from "../server/repository";
import { defaultSettings } from "../src/lib/storefront";

test("FreshCart API: accounts, permissions, stock, checkout and reviews", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-api-"));
  process.env.FRESHCART_DATA_DIR = directory;
  // Bulk fixture; dedicated checkout safeguards test the default limits.
  process.env.MAX_OUTSTANDING_COD = "100";
  process.env.CHECKOUT_RATE_MAX = "1000";
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
    delete process.env.FRESHCART_DATA_DIR;
    delete process.env.MAX_OUTSTANDING_COD;
    delete process.env.CHECKOUT_RATE_MAX;
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function request(
    path: string,
    body?: unknown,
    cookie = "",
    method = body === undefined ? "GET" : "POST",
  ) {
    return fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  const customer = {
    name: "Test Shopper",
    phone: "01712345678",
    address: "House 12, Road 7, Dhaka",
    area: "Dhanmondi",
  };
  const checkout = (changes: Record<string, unknown> = {}) => ({
    customer,
    items: [{ productId: "banana", quantity: 1 }],
    deliverySelection: { date: deliveryDays()[1].date, slot: "afternoon" },
    instructions: "",
    acceptedTerms: true,
    payment: "cash-on-delivery",
    requestId: randomUUID(),
    accessToken: randomUUID(),
    ...changes,
  });
  let alice = "",
    bob = "",
    admin = "",
    reference = "",
    guestReference = "",
    guestToken = "";
  await t.test(
    "catalog filters, variants, validation and request origin",
    async () => {
      const response = await request(
        "/products?category=produce&sort=price-asc&limit=4",
      );
      const data = await response.json();
      assert.equal(data.total, 8);
      assert.equal(data.products[0].id, "cucumber");
      assert.equal((await request("/products?sort=invalid")).status, 400);
      const variants = await (await request("/products?pack=500%20g")).json();
      assert.ok(
        variants.products.some((p: { id: string }) => p.id === "apple-500g"),
      );
      assert.equal((await request("/products/missing")).status, 404);
      const cross = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: "{}",
      });
      assert.equal(cross.status, 403);
      const csrf = await fetch(`${base}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      });
      assert.equal(csrf.status, 415);
    },
  );
  await t.test(
    "registration always creates customers, sessions are private, and login works on another device",
    async () => {
      const register = async (email: string) => {
        const response = await request("/auth/register", {
          name: "Test Customer",
          email,
          password: "test-password-123",
          role: "admin",
        });
        assert.equal(response.status, 201);
        const data = await response.json();
        assert.equal(data.user.role, "customer");
        assert.equal(data.user.passwordHash, undefined);
        assert.match(response.headers.get("set-cookie") || "", /HttpOnly/i);
        assert.match(response.headers.get("set-cookie") || "", /SameSite=Lax/i);
        return response.headers.get("set-cookie")!.split(";")[0];
      };
      alice = await register("alice@example.test");
      bob = await register("bob@example.test");
      admin = await register("admin@example.test");
      await atomic(async () => {
        const user = (await userByEmail("admin@example.test"))!;
        await saveUser({ ...user, role: "admin" });
      });
      assert.equal((await request("/admin/overview")).status, 401);
      assert.equal(
        (await request("/admin/overview", undefined, alice)).status,
        403,
      );
      assert.equal(
        (await request("/admin/overview", undefined, admin)).status,
        200,
      );
      assert.equal(
        (
          await request("/auth/login", {
            email: "alice@example.test",
            password: "wrong",
          })
        ).status,
        401,
      );
      const second = await request("/auth/login", {
        email: "alice@example.test",
        password: "test-password-123",
      });
      assert.equal(second.status, 200);
      const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
      const savedAddress = { ...customer, id: randomUUID(), label: "Home" };
      assert.equal(
        (
          await request(
            "/me",
            { name: "Alice", addresses: [savedAddress] },
            alice,
            "PATCH",
          )
        ).status,
        200,
      );
      const me = await (await request("/me", undefined, secondCookie)).json();
      assert.equal(me.user.addresses[0].address, customer.address);
      assert.equal(
        (await (await request("/me", undefined, bob)).json()).user.addresses
          .length,
        0,
      );
      await request(
        "/me/cart",
        { items: [{ productId: "apple", quantity: 2 }] },
        alice,
        "PUT",
      );
      assert.equal(
        (await (await request("/me/cart", undefined, secondCookie)).json())
          .items[0].quantity,
        2,
      );
    },
  );
  await t.test(
    "checkout reprices on the server, persists snapshots and enforces private ownership",
    async () => {
      const payload = checkout({
        items: ["banana", "apple", "milk", "bread"].map((productId) => ({
          productId,
          quantity: 1,
        })),
        promo: "FRESH10",
        total: 1,
      });
      assert.equal(
        (await request("/orders", checkout({ expectedTotal: 1 }), alice))
          .status,
        409,
      );
      const response = await request("/orders", payload, alice);
      assert.equal(response.status, 201);
      const result = await response.json();
      reference = result.reference;
      assert.equal(result.total, 454);
      assert.equal(result.order.accessTokenHash, undefined);
      assert.equal(result.order.fingerprint, undefined);
      const saved = await findOrder(reference);
      assert.equal(saved!.items[0].price, 70);
      assert.notEqual(saved!.accessTokenHash, payload.accessToken);
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        29,
      );
      const repeated = await request("/orders", payload, alice);
      assert.equal(repeated.status, 200);
      assert.equal((await repeated.json()).reference, reference);
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        29,
      );
      assert.equal(
        (
          await request(
            "/orders",
            { ...payload, instructions: "Changed" },
            alice,
          )
        ).status,
        409,
      );
      assert.equal((await request(`/orders/${reference}`)).status, 404);
      assert.equal(
        (await request(`/orders/${reference}`, undefined, bob)).status,
        404,
      );
      const own = await request(`/orders/${reference}`, undefined, alice);
      assert.equal(own.status, 200);
      assert.equal(own.headers.get("cache-control"), "private, no-store");
      const list = await (await request("/me/orders", undefined, alice)).json();
      assert.ok(
        list.orders.some(
          (o: { reference: string }) => o.reference === reference,
        ),
      );
      assert.equal(
        (await request("/orders", checkout({ acceptedTerms: false }), alice))
          .status,
        400,
      );
      assert.equal(
        (await request("/orders", checkout({ payment: "card" }), alice)).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/orders",
            checkout({ instructions: "a".repeat(201) }),
            alice,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/orders",
            checkout({
              deliverySelection: { date: "2000-01-01", slot: "morning" },
            }),
            alice,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/orders",
            checkout({ items: [{ productId: "banana", quantity: 100 }] }),
            alice,
          )
        ).status,
        409,
      );
      assert.equal(
        (await request("/orders", checkout({ promo: "INVALID" }), alice))
          .status,
        400,
      );
    },
  );
  await t.test(
    "guest order access requires its receipt; claiming it requires proof",
    async () => {
      const payload = checkout();
      guestToken = payload.accessToken;
      const result = await (await request("/orders", payload)).json();
      guestReference = result.reference;
      assert.equal(
        (await request(`/orders/${guestReference}`, undefined, alice)).status,
        404,
      );
      const proof = await fetch(`${base}/api/orders/${guestReference}`, {
        headers: { Authorization: `Bearer ${guestToken}` },
      });
      assert.equal(proof.status, 200);
      await request(
        "/me/import",
        {
          addresses: [],
          items: [],
          receipts: [{ reference: guestReference, accessToken: "wrong-token" }],
        },
        bob,
      );
      assert.equal(
        (await request(`/orders/${guestReference}`, undefined, bob)).status,
        404,
      );
      await request(
        "/me/import",
        {
          addresses: [],
          items: [],
          receipts: [{ reference: guestReference, accessToken: guestToken }],
        },
        alice,
      );
      assert.equal(
        (await request(`/orders/${guestReference}`, undefined, alice)).status,
        200,
      );
      assert.equal(
        (await request(`/orders/${guestReference}`, undefined, bob)).status,
        404,
      );
    },
  );
  await t.test(
    "address editing, valid fulfilment transitions and cancellation restore stock once",
    async () => {
      const changed = await request(
        `/orders/${reference}/address`,
        { customer: { ...customer, address: "Updated house, Road 9, Dhaka" } },
        alice,
        "PATCH",
      );
      assert.equal(changed.status, 200);
      assert.equal(
        (
          await request(
            `/orders/${reference}/address`,
            { customer: { ...customer, area: "Uttara" } },
            alice,
            "PATCH",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}`,
            { status: "delivered" },
            admin,
            "PATCH",
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}`,
            { status: "preparing" },
            alice,
            "PATCH",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}`,
            { status: "preparing" },
            admin,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            `/orders/${reference}/address`,
            { customer },
            alice,
            "PATCH",
          )
        ).status,
        409,
      );
      const before = (await getCatalog()).find((p) => p.id === "banana")!.stock;
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}`,
            { status: "cancelled" },
            admin,
            "PATCH",
          )
        ).status,
        200,
      );
      await request(
        `/admin/orders/${reference}`,
        { status: "cancelled" },
        admin,
        "PATCH",
      );
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        before + 1,
      );
      assert.equal(
        (
          await request(
            `/admin/orders/${reference}`,
            { status: "preparing" },
            admin,
            "PATCH",
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "concurrent orders cannot oversell, and duplicate requests reserve once",
    async () => {
      const banana = (await getCatalog()).find((p) => p.id === "banana")!;
      const sku = {
        ...banana,
        id: "last-one",
        slug: "last-one",
        stock: 1,
        price: 15,
        originalPrice: undefined,
        version: 0,
      };
      assert.equal(
        (await request("/admin/products/last-one", sku, admin, "PUT")).status,
        200,
      );
      const concurrent = await Promise.all([
        request(
          "/orders",
          checkout({ items: [{ productId: "last-one", quantity: 1 }] }),
          alice,
        ),
        request(
          "/orders",
          checkout({ items: [{ productId: "last-one", quantity: 1 }] }),
          bob,
        ),
      ]);
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
      const payload = checkout();
      const repeated = await Promise.all([
        request("/orders", payload, alice),
        request("/orders", payload, alice),
      ]);
      assert.deepEqual(repeated.map((r) => r.status).sort(), [200, 201]);
      const stale = { ...banana, price: 77 };
      assert.equal(
        (await request("/admin/products/banana", stale, admin, "PUT")).status,
        409,
      );
    },
  );
  await t.test(
    "storefront configuration controls checkout and validates references",
    async () => {
      const settings = structuredClone(defaultSettings);
      settings.zones[0].enabled = false;
      settings.slots[1].enabled = false;
      assert.equal(
        (await request("/admin/settings", settings, alice, "PUT")).status,
        403,
      );
      assert.equal(
        (await request("/admin/settings", settings, admin, "PUT")).status,
        200,
      );
      assert.equal((await request("/orders", checkout(), alice)).status, 400);
      assert.equal(
        (
          await request(
            "/admin/settings",
            {
              ...settings,
              zones: [
                settings.zones[0],
                settings.zones[0],
                settings.zones[2],
                settings.zones[3],
              ],
            },
            admin,
            "PUT",
          )
        ).status,
        400,
      );
      settings.bundles[0].items[0].productId = "missing";
      assert.equal(
        (await request("/admin/settings", settings, admin, "PUT")).status,
        400,
      );
      await request("/admin/settings", defaultSettings, admin, "PUT");
    },
  );
  await t.test(
    "support requests enforce order access and administrator resolution",
    async () => {
      assert.equal(
        (
          await request(
            `/orders/${guestReference}/support`,
            { message: "A support request from another customer." },
            bob,
          )
        ).status,
        404,
      );
      const sent = await request(
        `/orders/${guestReference}/support`,
        { message: "Please check this test delivery request." },
        alice,
      );
      assert.equal(sent.status, 201);
      const ticket = await sent.json();
      const overview = await (
        await request("/admin/overview", undefined, admin)
      ).json();
      assert.ok(
        overview.support.some((item: { id: string }) => item.id === ticket.id),
      );
      assert.equal(
        (
          await request(
            `/admin/support/${ticket.id}`,
            { status: "resolved" },
            bob,
            "PATCH",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/admin/support/${ticket.id}`,
            { status: "resolved" },
            admin,
            "PATCH",
          )
        ).status,
        200,
      );
    },
  );
  await t.test(
    "reviews require a real delivered purchase, moderation controls visibility",
    async () => {
      const review = {
        reference: guestReference,
        productId: "banana",
        rating: 5,
        text: "Fresh and carefully packed groceries.",
      };
      assert.equal((await request("/reviews", review)).status, 401);
      assert.equal((await request("/reviews", review, alice)).status, 403);
      await atomic(async () => {
        const order = (await findOrder(guestReference))!;
        await replaceOrder({ ...order, status: "delivered", mode: "mongodb" });
      });
      assert.equal((await request("/reviews", review, bob)).status, 403);
      assert.equal((await request("/reviews", review, alice)).status, 201);
      assert.equal(
        (await (await request("/reviews")).json()).reviews.length,
        0,
      );
      const overview = await (
        await request("/admin/overview", undefined, admin)
      ).json();
      const id = overview.reviews[0].id;
      assert.equal(
        (
          await request(
            `/admin/reviews/${id}`,
            { status: "approved" },
            alice,
            "PATCH",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/admin/reviews/${id}`,
            { status: "approved" },
            admin,
            "PATCH",
          )
        ).status,
        200,
      );
      const visible = await (await request("/reviews?productId=banana")).json();
      assert.equal(visible.reviews.length, 1);
      assert.equal(visible.reviews[0].userId, undefined);
      assert.equal(visible.reviews[0].reference, undefined);
      assert.equal((await request("/reviews", review, alice)).status, 409);
    },
  );
  await t.test(
    "reset links are single-use and password reset revokes old sessions",
    async () => {
      assert.equal(
        (await request("/auth/forgot", { email: "alice@example.test" })).status,
        503,
      );
      const token = "a".repeat(64);
      await atomic(async () => {
        const user = (await userByEmail("alice@example.test"))!;
        await saveUser({
          ...user,
          resetHash: digest(token),
          resetExpires: Date.now() + 100000,
        });
      });
      assert.equal(
        (
          await request("/auth/reset", {
            email: "alice@example.test",
            token: "b".repeat(64),
            password: "new-password-123",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/auth/reset", {
            email: "alice@example.test",
            token,
            password: "new-password-123",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/auth/reset", {
            email: "alice@example.test",
            token,
            password: "other-password-123",
          })
        ).status,
        400,
      );
      assert.equal((await request("/me", undefined, alice)).status, 401);
      assert.equal(
        (
          await request("/auth/login", {
            email: "alice@example.test",
            password: "test-password-123",
          })
        ).status,
        401,
      );
      const login = await request("/auth/login", {
        email: "alice@example.test",
        password: "new-password-123",
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")!.split(";")[0];
      await request("/auth/logout", {}, cookie);
      assert.equal((await request("/me", undefined, cookie)).status, 401);
    },
  );
});
