import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import { app } from "../server/app";
import { atomic, writeEntity, readEntity } from "../server/repository";
import { userByEmail, saveUser } from "../server/auth";
import {
  getCatalog,
  getPublicCatalog,
  saveCatalog,
  findOrder,
} from "../server/store";
import { placeOrder, changeStatus, publicOrder } from "../server/checkout";
import { getBatches } from "../server/inventory-store";
import { products } from "../src/lib/catalog";
import { recipes } from "../src/lib/recipes";
import { defaultContent } from "../src/lib/management";
import { deliveryDays } from "../src/lib/orders";
import {
  dhakaDate,
  stockSummary,
  allocateBatches,
  type InventoryBatch,
} from "../src/lib/inventory";
import {
  localizeEntity,
  localizeProduct,
  confirmTranslations,
  translatedText,
  withText,
} from "../src/lib/content-language";
import { searchProducts } from "../src/lib/search";

test("merchant translations localize copy, retain bilingual search and fall back after source edits", () => {
  const product = confirmTranslations("product", {
    ...products[0],
    name: "Test orchard banana",
    translations: {
      bn: { name: { source: "", text: "পরীক্ষার বাগানের কলা" } },
    },
  });
  assert.equal(localizeProduct(product, "bn").name, "পরীক্ষার বাগানের কলা");
  assert.equal(localizeProduct(product, "en").name, "Test orchard banana");
  assert.equal(
    searchProducts([localizeProduct(product, "bn")], "orchard")[0].id,
    product.id,
  );
  assert.equal(searchProducts([product], "বাগানের")[0].id, product.id);
  assert.equal(
    translatedText({ ...product, name: "Edited banana" }, "name", "bn"),
    "Edited banana",
  );
  const recipe = confirmTranslations("recipe", {
    ...recipes[0],
    translations: {
      bn: {
        "steps.0": { source: "", text: "প্রথমে সবজি ধুয়ে নিন।" },
        "ingredients.0.name": { source: "", text: "তাজা শসা" },
      },
    },
  });
  assert.equal(
    localizeEntity("recipe", recipe, "bn").steps[0],
    "প্রথমে সবজি ধুয়ে নিন।",
  );
  const reordered = { ...recipe, steps: [...recipe.steps].reverse() };
  assert.equal(
    localizeEntity("recipe", reordered, "bn").steps[0],
    reordered.steps[0],
  );
  assert.throws(
    () => withText(product, "__proto__.polluted", "bad"),
    /Invalid/,
  );
});

test("PWA worker caches only its public shell and uses network-only private navigation", async () => {
  const listeners: Record<string, (e: any) => void> = {};
  const cached: string[] = [];
  let online = true;
  const offline = new Response("offline shell");
  const context = vm.createContext({
    URL,
    Response,
    self: {
      location: { origin: "https://freshcart.test" },
      clients: { claim: async () => {} },
      addEventListener: (type: string, handler: any) => {
        listeners[type] = handler;
      },
      skipWaiting: () => {},
    },
    caches: {
      open: async () => ({
        addAll: async (paths: string[]) => {
          cached.push(...paths);
        },
      }),
      keys: async () => [],
      match: async () => offline,
      delete: async () => true,
    },
    fetch: async () => {
      if (!online) throw new Error("offline");
      return new Response("network");
    },
  });
  vm.runInContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    context,
  );
  let work: Promise<unknown> | undefined;
  listeners.install({ waitUntil: (p: Promise<unknown>) => (work = p) });
  await work;
  assert.ok(cached.includes("/offline.html"));
  assert.ok(
    cached.every(
      (path) => path === "/offline.html" || path.startsWith("/icons/"),
    ),
  );
  for (const path of [
    "/api/me/cart",
    "/api/admin/purchasing",
    "/?_rsc=private",
  ]) {
    let intercepted = false;
    listeners.fetch({
      request: {
        url: `https://freshcart.test${path}`,
        method: "GET",
        mode: "cors",
      },
      respondWith: () => {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
  }
  let response: Promise<Response> | undefined;
  listeners.fetch({
    request: {
      url: "https://freshcart.test/account",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (p: Promise<Response>) => (response = p),
  });
  assert.equal(await (await response!).text(), "network");
  online = false;
  listeners.fetch({
    request: {
      url: "https://freshcart.test/checkout",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (p: Promise<Response>) => (response = p),
  });
  assert.equal(await (await response!).text(), "offline shell");
});

test("purchasing and bilingual CMS enforce permissions, persistence, expiry and atomic stock", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-batches-"));
  process.env.FRESHCART_DATA_DIR = directory;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
    delete process.env.FRESHCART_DATA_DIR;
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const request = (
    path: string,
    body?: unknown,
    cookie = "",
    method = body === undefined ? "GET" : "POST",
  ) =>
    fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const sessions: Record<string, string> = {};
  for (const role of ["admin", "editor", "customer"] as const) {
    const email = `${role}@batch.example.test`;
    const r = await request("/auth/register", {
      name: `Batch ${role}`,
      email,
      password: "Batch-test-12345",
    });
    assert.equal(r.status, 201);
    sessions[role] = r.headers.get("set-cookie")!.split(";")[0];
    if (role !== "customer") {
      const user = (await userByEmail(email))!;
      await atomic(() => saveUser({ ...user, role }));
    }
  }
  const supplierId = randomUUID();
  await t.test(
    "purchase costs and supplier contacts are private; supplier edits are versioned",
    async () => {
      assert.equal((await request("/admin/purchasing")).status, 401);
      for (const role of ["editor", "customer"])
        assert.equal(
          (await request("/admin/purchasing", undefined, sessions[role]))
            .status,
          403,
        );
      const supplier = {
        name: "Test farm",
        contact: "Supply contact",
        phone: "",
        email: "",
        address: "",
        notes: "",
        active: true,
        version: 0,
      };
      assert.equal(
        (
          await request(
            `/admin/suppliers/${supplierId}`,
            supplier,
            sessions.admin,
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            `/admin/suppliers/${supplierId}`,
            supplier,
            sessions.admin,
            "PUT",
          )
        ).status,
        409,
      );
    },
  );
  let first: InventoryBatch;
  await t.test(
    "receipt retries cannot double stock and independent receipts add atomically",
    async () => {
      const initial = (await getCatalog()).find(
        (p) => p.id === "banana",
      )!.stock;
      const today = dhakaDate(),
        future = new Date(Date.now() + 20 * 86400000)
          .toISOString()
          .slice(0, 10);
      const receipt = {
        receiptId: randomUUID(),
        supplierId,
        productId: "banana",
        batchNumber: "EARLY",
        receivedOn: today,
        expiresOn: future,
        quantity: 5,
        unitCost: 32.5,
      };
      const result = await request("/admin/batches", receipt, sessions.admin);
      assert.equal(result.status, 200);
      first = (await result.json()).batch;
      assert.equal(
        (await request("/admin/batches", receipt, sessions.admin)).status,
        200,
      );
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        initial + 5,
      );
      assert.equal(
        (
          await request(
            "/admin/batches",
            { ...receipt, quantity: 6 },
            sessions.admin,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "/admin/batches",
            { ...receipt, receiptId: randomUUID(), expiresOn: "2000-01-01" },
            sessions.admin,
          )
        ).status,
        400,
      );
      const parallel = await Promise.all(
        ["LATE-A", "LATE-B"].map((batchNumber) =>
          request(
            "/admin/batches",
            {
              ...receipt,
              receiptId: randomUUID(),
              batchNumber,
              expiresOn: null,
              quantity: 2,
            },
            sessions.admin,
          ),
        ),
      );
      assert.ok(parallel.every((r) => r.status === 200));
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        initial + 9,
      );
      const publicText = JSON.stringify(
        await (await request("/catalog")).json(),
      );
      assert.ok(!publicText.includes("unitCost"));
      assert.ok(!publicText.includes("Supply contact"));
    },
  );
  await t.test(
    "checkout reserves earliest expiry, cancellation restores once, stale stock edits fail",
    async () => {
      const day = deliveryDays().find((d) => d.slots.length)!;
      const order = (
        await placeOrder(
          {
            requestId: randomUUID(),
            accessToken: randomUUID(),
            customer: {
              name: "Test buyer",
              phone: "01712345678",
              address: "Test house, test road",
              area: "Dhanmondi",
            },
            items: [{ productId: "banana", quantity: 3 }],
            deliverySelection: { date: day.date, slot: day.slots[0].id },
            payment: "cash-on-delivery",
            instructions: "",
            acceptedTerms: true,
          },
          null,
        )
      ).order;
      assert.equal(order.inventoryAllocations?.[0].batchId, first.id);
      assert.equal(
        (await readEntity<InventoryBatch>(`batch:${first.id}`))!.remaining,
        2,
      );
      assert.ok(!Object.hasOwn(publicOrder(order), "inventoryAllocations"));
      const reserved = (await readEntity<InventoryBatch>(`batch:${first.id}`))!;
      await atomic(() =>
        writeEntity(`batch:${first.id}`, {
          ...reserved,
          expiresOn: "2000-01-01",
        }),
      );
      await assert.rejects(
        () => changeStatus(order.reference, "preparing"),
        /batch has expired/,
      );
      await atomic(() => writeEntity(`batch:${first.id}`, reserved));
      await changeStatus(order.reference, "cancelled");
      await changeStatus(order.reference, "cancelled");
      assert.equal(
        (await readEntity<InventoryBatch>(`batch:${first.id}`))!.remaining,
        5,
      );
      const catalog = await getCatalog();
      await assert.rejects(
        () =>
          atomic(() =>
            saveCatalog(
              catalog.map((p) => (p.id === "banana" ? { ...p, stock: 0 } : p)),
            ),
          ),
        /remaining batch/,
      );
      assert.equal(
        (await findOrder(order.reference))!.inventoryReserved,
        false,
      );
    },
  );
  await t.test(
    "expired packs are excluded and disposal is versioned with audit stock reconciliation",
    async () => {
      const expired = { ...first, expiresOn: "2000-01-01" };
      await atomic(() => writeEntity(`batch:${first.id}`, expired));
      const raw = (await getCatalog()).find((p) => p.id === "banana")!,
        publicProduct = (await getPublicCatalog()).find(
          (p) => p.id === "banana",
        )!;
      assert.equal(publicProduct.stock, raw.stock - 5);
      const batches = await getBatches();
      assert.throws(
        () => allocateBatches("banana", raw.stock, raw.stock, batches),
        /Insufficient/,
      );
      const input = {
        quantity: 2,
        version: expired.version,
        reason: "Expired packs removed",
      };
      assert.equal(
        (
          await request(
            `/admin/batches/${first.id}/withdraw`,
            input,
            sessions.admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            `/admin/batches/${first.id}/withdraw`,
            input,
            sessions.admin,
          )
        ).status,
        409,
      );
      assert.equal(
        (await getCatalog()).find((p) => p.id === "banana")!.stock,
        raw.stock - 2,
      );
      assert.equal(
        (await readEntity<InventoryBatch>(`batch:${first.id}`))!.remaining,
        3,
      );
      const summary = stockSummary(raw.stock, [expired], dhakaDate());
      assert.equal(summary.expired, 5);
    },
  );
  await t.test(
    "both languages persist for products, homepage and recipes without changing prices or slugs",
    async () => {
      const old = (await getCatalog()).find((p) => p.id === "banana")!;
      const product = confirmTranslations("product", {
        ...old,
        translations: {
          bn: { name: { source: "", text: "সতেজ বাগানের কলা" } },
        },
      });
      assert.equal(
        (
          await request(
            "/admin/products/banana",
            product,
            sessions.editor,
            "PUT",
          )
        ).status,
        200,
      );
      const stored = (await getCatalog()).find((p) => p.id === "banana")!;
      assert.equal(stored.price, old.price);
      assert.equal(stored.slug, old.slug);
      assert.equal(localizeProduct(stored, "bn").name, "সতেজ বাগানের কলা");
      assert.equal(
        (
          await request(
            "/admin/products/banana",
            product,
            sessions.editor,
            "PUT",
          )
        ).status,
        409,
      );
      const content = confirmTranslations("homepage", {
        ...structuredClone(defaultContent),
        translations: {
          bn: { "banners.0.title": { source: "", text: "খামারের তাজা বাজার" } },
        },
      });
      assert.equal(
        (await request("/admin/content", content, sessions.editor, "PUT"))
          .status,
        200,
      );
      assert.equal(
        localizeEntity(
          "homepage",
          (await (await request("/content")).json()).content,
          "bn",
        ).banners[0].title,
        "খামারের তাজা বাজার",
      );
      const recipe = confirmTranslations("recipe", {
        ...recipes[0],
        version: 0,
        translations: {
          bn: { title: { source: "", text: "বাগানের সবজি সালাদ" } },
        },
      });
      assert.equal(
        (
          await request(
            `/admin/recipes/${recipe.slug}`,
            recipe,
            sessions.editor,
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        localizeEntity(
          "recipe",
          (await (await request(`/recipes/${recipe.slug}`)).json()).recipe,
          "bn",
        ).title,
        "বাগানের সবজি সালাদ",
      );
      assert.equal(
        (
          await request(
            "/admin/products/banana",
            {
              ...stored,
              translations: { bn: { price: { source: "70", text: "1" } } },
            },
            sessions.editor,
            "PUT",
          )
        ).status,
        400,
      );
    },
  );
});
