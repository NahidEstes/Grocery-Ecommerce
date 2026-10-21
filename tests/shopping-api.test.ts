import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { app } from "../server/app";
import { atomic } from "../server/repository";
import { userByEmail } from "../server/auth";
import { replaceOrder, getCatalog, saveCatalog } from "../server/store";
import { placeOrder } from "../server/checkout";
import { deliveryDays } from "../src/lib/orders";

test("personal shopping API: account isolation, lists, current prices and active order summaries", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-lists-"));
  process.env.FRESHCART_DATA_DIR = directory;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await rm(directory, { recursive: true, force: true });
    delete process.env.FRESHCART_DATA_DIR;
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
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function register(email: string) {
    const res = await request("/auth/register", {
      name: "Shopping Tester",
      email,
      password: "shopping-test-123",
    });
    assert.equal(res.status, 201);
    return res.headers.get("set-cookie")!.split(";")[0];
  }
  const alice = await register("lists-alice@example.test"),
    bob = await register("lists-bob@example.test");
  let listId = "",
    version = 1;
  await t.test(
    "private summaries require sign-in and bilingual search works through the API",
    async () => {
      assert.equal((await request("/me/shopping")).status, 401);
      const found = await (
        await request("/products?q=" + encodeURIComponent("আলু"))
      ).json();
      assert.equal(found.products[0].id, "potato");
      assert.equal(
        (await (await request("/me/shopping", undefined, bob)).json()).lists
          .length,
        0,
      );
    },
  );
  await t.test(
    "lists preserve wanted quantities and cannot forge names, prices or ownership",
    async () => {
      const response = await request(
        "/me/lists",
        {
          name: "সাপ্তাহিক বাজার",
          notes: "For breakfast",
          userId: "forged",
          items: [
            { productId: "milk", quantity: 70, name: "Forged name", price: 1 },
            { productId: "milk", quantity: 20 },
            { productId: "banana", quantity: 2 },
          ],
        },
        alice,
      );
      assert.equal(response.status, 201);
      const { list } = await response.json();
      listId = list.id;
      version = list.version;
      assert.equal(list.name, "সাপ্তাহিক বাজার");
      assert.equal(list.items[0].quantity, 90);
      assert.equal(list.items[0].name, "Fresh Milk");
      assert.equal(list.items[0].price, undefined);
      assert.equal(list.userId, undefined);
      assert.equal(
        (
          await request(
            "/me/lists",
            {
              name: "Bad list",
              items: [
                { productId: "milk", quantity: 70 },
                { productId: "milk", quantity: 40 },
              ],
            },
            alice,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/me/lists",
            {
              name: "Bad list",
              items: [{ productId: "unknown", quantity: 1 }],
            },
            alice,
          )
        ).status,
        400,
      );
      assert.equal(
        (await (await request("/me/cart", undefined, alice)).json()).items
          .length,
        0,
      );
    },
  );
  await t.test(
    "list edits and archives enforce ownership and reject stale versions",
    async () => {
      const input = {
        name: "Updated list",
        items: [{ productId: "milk", quantity: 2 }],
        version,
      };
      assert.equal(
        (await request(`/me/lists/${listId}`, input, bob, "PUT")).status,
        404,
      );
      assert.equal(
        (
          await request(
            `/me/lists/${listId}/archive`,
            { version, archived: true },
            bob,
            "PATCH",
          )
        ).status,
        404,
      );
      const saved = await request(`/me/lists/${listId}`, input, alice, "PUT");
      assert.equal(saved.status, 200);
      version = (await saved.json()).list.version;
      assert.equal(
        (await request(`/me/lists/${listId}`, input, alice, "PUT")).status,
        409,
      );
      const archived = await request(
        `/me/lists/${listId}/archive`,
        { version, archived: true },
        alice,
        "PATCH",
      );
      assert.equal(archived.status, 200);
      version = (await archived.json()).list.version;
      assert.equal(
        (
          await request(
            `/me/lists/${listId}`,
            { ...input, version },
            alice,
            "PUT",
          )
        ).status,
        409,
      );
      const restored = await request(
        `/me/lists/${listId}/archive`,
        { version, archived: false },
        alice,
        "PATCH",
      );
      assert.equal(restored.status, 200);
      version = (await restored.json()).list.version;
      const login = await request("/auth/login", {
        email: "lists-alice@example.test",
        password: "shopping-test-123",
      });
      const secondDevice = login.headers.get("set-cookie")!.split(";")[0];
      const data = await (
        await request("/me/shopping", undefined, secondDevice)
      ).json();
      assert.equal(data.lists[0].id, listId);
      assert.equal(data.lists[0].archived, false);
      assert.equal(
        (await (await request("/me/shopping", undefined, bob)).json()).lists
          .length,
        0,
      );
    },
  );
  await t.test(
    "summaries track actual status updates without exposing the address or receipt",
    async () => {
      const user = (await userByEmail("lists-alice@example.test"))!;
      const { order } = await placeOrder(
        {
          customer: {
            name: "List Shopper",
            phone: "01712345678",
            address: "Private test address, Dhaka",
            area: "Dhanmondi",
          },
          items: [{ productId: "milk", quantity: 1 }],
          deliverySelection: {
            date: deliveryDays()[1].date,
            slot: "afternoon",
          },
          instructions: "Private instructions",
          payment: "cash-on-delivery",
          acceptedTerms: true,
          requestId: randomUUID(),
          accessToken: randomUUID(),
        },
        user,
      );
      let data = await (await request("/me/shopping", undefined, alice)).json();
      assert.equal(data.regular[0].productId, "milk");
      assert.equal(data.activeOrder.reference, order.reference);
      assert.equal(data.activeOrder.customer, undefined);
      assert.equal(data.activeOrder.accessTokenHash, undefined);
      assert.equal(
        (await (await request("/me/shopping", undefined, bob)).json())
          .activeOrder,
        null,
      );
      await atomic(async () => {
        await replaceOrder({ ...order, status: "delivered" });
        const catalog = await getCatalog();
        await saveCatalog(
          catalog.map((p) => (p.id === "milk" ? { ...p, price: 95 } : p)),
        );
      });
      data = await (await request("/me/shopping", undefined, alice)).json();
      assert.equal(data.activeOrder, null);
      assert.equal(data.regular[0].quantity, 1);
      assert.equal(data.regular[0].price, undefined);
      assert.equal(
        (await (await request("/catalog")).json()).products.find(
          (p: { id: string }) => p.id === "milk",
        ).price,
        95,
      );
    },
  );
});
