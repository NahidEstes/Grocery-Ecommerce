import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { products, filterProducts } from "../src/lib/catalog";
import { defaultSettings } from "../src/lib/storefront";
import { defaultProfile, currencyText } from "../src/lib/store-profile";
import { cartTotals } from "../src/lib/commerce";
import { localInstant } from "../src/lib/orders";
import { demoApi } from "../src/lib/browser-demo/adapter";
import { demoCities, demoKey } from "../src/lib/browser-demo/config";
import {
  demoProducts,
  demoSettingsFor,
  demoCustomer,
} from "../src/lib/browser-demo/data";
import {
  demoDays,
  makeDemoOrder,
  readDemoOrders,
  storeDemoOrder,
} from "../src/lib/browser-demo/orders";
import { resetDemo } from "../src/lib/browser-demo/storage";

function child(flag: string | undefined, code: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, STORE_MODE: "demo" };
  if (flag === undefined) delete env.NEXT_PUBLIC_BROWSER_DEMO;
  else env.NEXT_PUBLIC_BROWSER_DEMO = flag;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", code],
    { env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
test("browser demo: only exact true enables bundled loaders and removes rewrites", () => {
  for (const flag of [undefined, "false", "TRUE", "1", "true"])
    child(
      flag,
      `
    import assert from 'node:assert/strict';
    import { BROWSER_DEMO } from './src/lib/browser-demo/config.ts';
    import config from './next.config.ts';
    import { loadCatalog, loadStorefront, loadRecipes } from './src/lib/api.ts';
    import { api } from './src/lib/client-api.ts';
    assert.equal(BROWSER_DEMO, ${flag === "true"});
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('backend unavailable'); };
    if (BROWSER_DEMO) {
      assert.equal((await loadStorefront()).settings.profile.currency, 'USD');
      assert.ok((await loadCatalog()).length);
      assert.ok((await loadRecipes()).length);
      assert.equal((await api('/auth/session')).user, null);
      await assert.rejects(api('/orders', { method: 'POST' }), /Disabled/);
      assert.equal(calls, 0);
      assert.deepEqual(await config.rewrites(), []);
    } else {
      for (const fn of [loadCatalog, loadStorefront, loadRecipes]) await assert.rejects(fn(), /unavailable/);
      await assert.rejects(api('/orders', { method: 'POST' }), /backend unavailable/);
      assert.equal(calls, 4);
      assert.equal((await config.rewrites())[0].source, '/api/:path*');
    }
  `,
    );
});
test("browser demo: USD samples are separate from intact BD settings and catalog", () => {
  assert.equal(defaultProfile.currency, "BDT");
  assert.equal(defaultProfile.city, "Dhaka");
  assert.equal(defaultSettings.zones[0].name, "Dhanmondi");
  assert.equal(products.find((p) => p.id === "apple")!.price, 225);
  assert.equal(demoProducts.find((p) => p.id === "apple")!.price, 5.99);
  assert.equal(currencyText(12.99, "USD"), "$12.99");
  for (const product of demoProducts) {
    assert.ok(product.price > 0 && product.price < 10);
    if (product.parentId)
      assert.ok(demoProducts.some((p) => p.id === product.parentId));
  }
  assert.ok(filterProducts(demoProducts, { q: "আপেল" }).total > 0);
  assert.ok(filterProducts(demoProducts, { q: "apple" }).total > 0);
  assert.equal(filterProducts(demoProducts, { limit: 8, page: 2 }).page, 2);
});
test("browser demo: cent-accurate promo, city fees, cap and free delivery", () => {
  for (const city of demoCities) {
    const settings = demoSettingsFor(city.name);
    const total = cartTotals(
      [{ productId: "apple", quantity: 1 }],
      demoProducts,
      "FRESH10",
      settings,
      city.name,
    );
    assert.equal(total.subtotal, 5.99);
    assert.equal(total.discount, 0.6);
    assert.equal(total.delivery, city.fee);
    assert.equal(total.total, Math.round((5.99 - 0.6 + city.fee) * 100) / 100);
    const big = cartTotals(
      [{ productId: "apple", quantity: 10 }],
      demoProducts,
      "FRESH10",
      settings,
      city.name,
    );
    assert.equal(big.delivery, 0);
    assert.equal(big.discount, 5);
    assert.equal(big.total, 54.9);
  }
});
test("browser demo: three city schedules and timestamps use DST-aware IANA zones", () => {
  for (const city of demoCities) {
    const settings = demoSettingsFor(city.name),
      now = new Date("2026-11-01T15:30:00Z");
    assert.equal(settings.profile.timeZone, city.timeZone);
    const days = demoDays(city.name, now);
    for (const day of days)
      for (const slot of day.slots) {
        assert.ok((city.slots as readonly string[]).includes(slot.id));
        assert.ok(
          localInstant(day.date, slot.start, city.timeZone).getTime() >
            now.getTime() + 3600_000,
        );
      }
    const next = days.find((day) => day.slots.length)!;
    const order = makeDemoOrder(
      [{ productId: "milk", quantity: 1 }],
      city.name,
      "",
      demoCustomer(city.name),
      { date: next.date, slot: next.slots[0].id },
      now,
      "TEST",
    );
    assert.equal(order.currency, "USD");
    assert.equal(order.timeZone, city.timeZone);
    assert.equal(order.customer.area, city.name);
  }
  assert.equal(
    localInstant("2026-07-01", "10:00", "America/New_York").toISOString(),
    "2026-07-01T14:00:00.000Z",
  );
  assert.equal(
    localInstant("2026-12-01", "10:00", "America/New_York").toISOString(),
    "2026-12-01T15:00:00.000Z",
  );
});
test("browser demo: read allowlist never fetches; mutations and unknown endpoints fail", async () => {
  const prior = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request");
  };
  try {
    assert.ok(
      (await demoApi<{ products: unknown[] }>("/catalog")).products.length,
    );
    for (const path of [
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
      "/orders",
      "/admin/products",
      "/reviews",
      "/refunds",
      "/search-misses",
    ])
      await assert.rejects(demoApi(path, { method: "POST" }), /Disabled/);
    await assert.rejects(demoApi("/admin/orders"), /Disabled/);
  } finally {
    globalThis.fetch = prior;
  }
});
test("browser demo: receipt storage rejects corrupt data, survives writes, scopes reset, handles blocked storage", () => {
  const data = new Map<string, string>([
    ["freshcart-cart", "normal BDT cart"],
    ["other-app", "keep"],
    ["freshcart-orders", "normal orders"],
  ]);
  let blocked = false,
    writeBlocked = false;
  const storage = {
    get length() {
      if (blocked) throw new Error("blocked");
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      if (blocked) throw new Error("blocked");
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (blocked || writeBlocked) throw new Error("blocked");
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      throw new Error("global clear forbidden");
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  try {
    for (const raw of [
      "{broken",
      "null",
      '[{"reference":"DEMO-CORRUPT","customer":null}]',
      '[{"currency":"BDT"}]',
    ]) {
      data.set(demoKey("orders"), raw);
      assert.deepEqual(readDemoOrders(), []);
    }
    const area = "New York, NY",
      now = new Date("2026-10-20T12:00:00Z"),
      day = demoDays(area, now)[1];
    const receipt = makeDemoOrder(
      [{ productId: "apple-500g", quantity: 2 }],
      area,
      "FRESH10",
      demoCustomer(area),
      { date: day.date, slot: day.slots[0].id },
      now,
      "STORAGE",
    );
    assert.equal(storeDemoOrder(receipt), true);
    assert.equal(readDemoOrders()[0].reference, receipt.reference);
    writeBlocked = true;
    const quotaReceipt = { ...receipt, reference: "DEMO-QUOTA" };
    assert.equal(storeDemoOrder(quotaReceipt), false);
    assert.equal(readDemoOrders()[0].reference, "DEMO-QUOTA");
    assert.equal(
      JSON.parse(data.get(demoKey("orders"))!)[0].reference,
      receipt.reference,
    );
    writeBlocked = false;
    assert.throws(
      () =>
        makeDemoOrder(
          [{ productId: "apple", quantity: 1 }],
          area,
          "",
          { ...demoCustomer(area), phone: "+8801712345678" },
          receipt.deliverySelection,
          now,
        ),
      /US phone/,
    );
    resetDemo();
    assert.deepEqual(readDemoOrders(), []);
    assert.equal(data.get("freshcart-cart"), "normal BDT cart");
    assert.equal(data.get("freshcart-orders"), "normal orders");
    assert.equal(data.get("other-app"), "keep");
    blocked = true;
    assert.equal(storeDemoOrder(receipt), false);
    assert.equal(readDemoOrders()[0].reference, receipt.reference);
    resetDemo();
    assert.deepEqual(readDemoOrders(), []);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
