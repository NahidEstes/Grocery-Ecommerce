import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHmac } from "node:crypto";
import { once } from "node:events";
import { gzipSync } from "node:zlib";
import { app } from "../server/app";
import { placeOrder, changeStatus } from "../server/checkout";
import {
  getCatalog,
  findOrder,
  replaceOrder,
  listOrders,
  getSettings,
  saveSettings,
} from "../server/store";
import {
  atomic,
  writeEntity,
  deleteEntity,
  listEntities,
} from "../server/repository";
import { register, saveUser } from "../server/auth";
import { deliveryDays, localInstant } from "../src/lib/orders";
import { defaultProfile, normalizePhone } from "../src/lib/store-profile";
import { validateRuntime } from "../server/store-mode";
import { settingsSchema } from "../server/validation";
import {
  readCheckoutAttempt,
  saveCheckoutAttempt,
  forgetCheckoutAttempt,
  prepareCheckoutAttempt,
} from "../src/lib/checkout-attempt";
import type { AuditEvent } from "../src/lib/management";

test("release regression: shared checkout guard, recovery and external finance records", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-release-"));
  process.env.FRESHCART_DATA_DIR = directory;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}/api`;
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    delete process.env.FRESHCART_DATA_DIR;
    delete process.env.CHECKOUT_RATE_MAX;
    await rm(directory, { recursive: true, force: true });
  });
  const call = (
    path: string,
    body?: unknown,
    cookie = "",
    headers: Record<string, string> = {},
  ) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const input = (phone = "01712345678") => ({
    customer: {
      name: "Release Shopper",
      phone,
      address: "House 12 Road 7",
      area: "Dhanmondi",
    },
    items: [{ productId: "banana", quantity: 1 }],
    deliverySelection: {
      date: deliveryDays()[1].date,
      slot: "afternoon" as const,
    },
    instructions: "",
    payment: "cash-on-delivery" as const,
    acceptedTerms: true as const,
    requestId: randomUUID(),
    accessToken: randomUUID(),
  });
  const admin = await register(
    "Release Admin",
    "admin@release.example.test",
    "release-test-password",
  );
  await saveUser({ ...admin, role: "admin" });
  const signed = await call("/auth/login", {
    email: admin.email,
    password: "release-test-password",
  });
  assert.equal(signed.status, 200);
  const cookie = signed.headers.get("set-cookie")!.split(";")[0];
  const staff = await register(
    "Warehouse Staff",
    "staff@release.example.test",
    "release-test-password",
  );
  await saveUser({ ...staff, role: "fulfilment" });
  const staffCookie = (
    await call("/auth/login", {
      email: staff.email,
      password: "release-test-password",
    })
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  await t.test(
    "concurrent normalized COD identities stop at three, retry survives cap and cancellation restores capacity",
    async () => {
      const stock = (await getCatalog())[0].stock,
        requests = Array.from({ length: 6 }, (_, i) =>
          input(i % 2 ? "+8801712345678" : "01712345678"),
        );
      const results = await Promise.allSettled(
        requests.map((v) => placeOrder(v, null)),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
      assert.equal((await getCatalog())[0].stock, stock - 3);
      const index = results.findIndex((r) => r.status === "fulfilled"),
        retry = await placeOrder(requests[index], null);
      assert.equal(retry.created, false);
      assert.equal((await listOrders()).length, 3);
      await assert.rejects(
        () => placeOrder({ ...requests[index], instructions: "changed" }, null),
        /already been used/,
      );
      await Promise.all([
        changeStatus(retry.order.reference, "cancelled"),
        changeStatus(retry.order.reference, "cancelled"),
      ]);
      assert.equal((await getCatalog())[0].stock, stock - 2);
      await placeOrder(input(), null);
      assert.equal((await getCatalog())[0].stock, stock - 3);
    },
  );
  await t.test(
    "lost acknowledgement can be recovered with the same browser proof, never another customer's receipt",
    async () => {
      const request = input("01812345678");
      const created = await placeOrder(request, null);
      const count = (await listOrders()).length;
      assert.equal(
        (await call(`/checkout-attempt/${request.requestId}`)).status,
        404,
      );
      assert.equal(
        (
          await call(`/checkout-attempt/${request.requestId}`, undefined, "", {
            Authorization: `Bearer ${randomUUID()}`,
          })
        ).status,
        404,
      );
      const recovered = await call(
        `/checkout-attempt/${request.requestId}`,
        undefined,
        "",
        { Authorization: `Bearer ${request.accessToken}` },
      );
      assert.equal(recovered.status, 200);
      const body = await recovered.json();
      assert.equal(body.reference, created.order.reference);
      assert.equal(body.order.accessTokenHash, undefined);
      assert.equal(body.order.financeRevision, undefined);
      assert.equal((await placeOrder(request, null)).created, false);
      assert.equal((await listOrders()).length, count);
    },
  );
  await t.test(
    "malformed compressed request cannot terminate the API",
    async () => {
      const response = await fetch(base + "/health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        body: Buffer.concat([
          gzipSync(Buffer.from("{}")),
          Buffer.from([255, 255]),
        ]),
      });
      assert.ok([400, 404].includes(response.status));
      await response.text();
      assert.equal((await call("/health")).status, 200);
    },
  );
  let paidReference = "";
  await t.test(
    "paid cancellations require externally recorded full refund; partial, stale and duplicate actions are checked",
    async () => {
      const request = input("01912345678"),
        stock = (await getCatalog())[0].stock,
        { order } = await placeOrder(request, null);
      paidReference = order.reference;
      await atomic(() =>
        replaceOrder({ ...order, payment: "online", paymentStatus: "paid" }),
      );
      const endpoint = `/admin/orders/${order.reference}/finance`;
      assert.equal((await call(endpoint, undefined, staffCookie)).status, 403);
      assert.equal(
        (
          await call(
            endpoint,
            {
              id: randomUUID(),
              version: 0,
              kind: "refund",
              amount: 10,
              method: "Bank",
              reference: "unauthorized",
              note: "External evidence",
            },
            staffCookie,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 0 },
            cookie,
          )
        ).status,
        409,
      );
      const entry = {
        id: randomUUID(),
        version: 0,
        kind: "refund",
        amount: 20,
        method: "Bank",
        reference: "refund-release-1",
        note: "External bank receipt reviewed",
      };
      assert.equal((await call(endpoint, entry, cookie)).status, 200);
      assert.equal((await call(endpoint, entry, cookie)).status, 200);
      assert.equal(
        (await call(endpoint, { ...entry, amount: 21 }, cookie)).status,
        409,
      );
      assert.equal(
        (
          await call(
            endpoint,
            { ...entry, id: randomUUID(), reference: "new-stale-ref" },
            cookie,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            endpoint,
            { ...entry, id: randomUUID(), version: 1, amount: order.total },
            cookie,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 1 },
            cookie,
          )
        ).status,
        409,
      );
      const final = {
        ...entry,
        id: randomUUID(),
        version: 1,
        amount: order.total - 20,
        reference: "refund-release-2",
      };
      const concurrent = await Promise.all([
        call(endpoint, final, cookie),
        call(
          endpoint,
          { ...final, id: randomUUID(), reference: "refund-conflicting" },
          cookie,
        ),
      ]);
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
      const ledger = await (await call(endpoint, undefined, cookie)).json();
      assert.equal(ledger.finance.events.length, 2);
      assert.equal(ledger.refunded, order.total);
      assert.equal(ledger.finance.events[0].staffId, admin.id);
      assert.ok(Number.isFinite(Date.parse(ledger.finance.events[0].at)));
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 2 },
            cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 2 },
            cookie,
          )
        ).status,
        200,
      );
      assert.equal((await getCatalog())[0].stock, stock);
      assert.equal(
        (await listEntities<AuditEvent>("audit:")).filter(
          (e) => e.action === "finance.refund" && e.target === order.reference,
        ).length,
        2,
      );
    },
  );
  await t.test(
    "review reconciliation records actual received amount, old evidence becomes stale after callback changes",
    async () => {
      const { order } = await placeOrder(input("01612345678"), null);
      await atomic(() =>
        replaceOrder({ ...order, payment: "online", paymentStatus: "review" }),
      );
      const endpoint = `/admin/orders/${order.reference}/finance`;
      const entry = {
        id: randomUUID(),
        version: 0,
        kind: "reconciliation",
        amount: 0,
        method: "Gateway portal",
        reference: "review-no-charge",
        note: "Verified no funds received",
      };
      assert.equal((await call(endpoint, entry, cookie)).status, 200);
      const fresh = (await findOrder(order.reference))!;
      await atomic(() =>
        replaceOrder({
          ...fresh,
          paymentStatus: "paid",
          gatewayValidationId: "late-callback",
        }),
      );
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 1 },
            cookie,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            endpoint,
            {
              ...entry,
              id: randomUUID(),
              version: 1,
              amount: 0,
              reference: "incorrect-paid-total",
            },
            cookie,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            endpoint,
            {
              ...entry,
              id: randomUUID(),
              version: 1,
              amount: order.total,
              reference: "actual-paid-total",
            },
            cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            endpoint,
            {
              ...entry,
              id: randomUUID(),
              version: 2,
              kind: "refund",
              amount: order.total,
              method: "Bank",
              reference: "refund-release-1",
            },
            cookie,
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "delivered refunds require returns and dispatched cancellations require physical stock recovery",
    async () => {
      const { order } = await placeOrder(input("01512345678"), null);
      await changeStatus(order.reference, "preparing");
      await changeStatus(order.reference, "out-for-delivery");
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 0, stockRecovered: false },
            cookie,
          )
        ).status,
        409,
      );
      await changeStatus(order.reference, "delivered");
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/finance`,
            {
              id: randomUUID(),
              version: 0,
              kind: "refund",
              amount: 10,
              method: "Cash",
              reference: "delivered-direct",
              note: "Completed outside site",
            },
            cookie,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            `/admin/orders/${order.reference}/cancel`,
            { version: 0, stockRecovered: true },
            cookie,
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "persisted per-client rate limiter ignores arbitrary forwarded headers, gives retry delay and expires",
    async () => {
      process.env.CHECKOUT_RATE_MAX = "2";
      assert.equal((await call("/orders", {})).status, 400);
      assert.equal(
        (await call("/orders", {}, "", { "X-Forwarded-For": "198.51.100.1" }))
          .status,
        400,
      );
      const blocked = await call("/orders", {}, "", {
        "X-Forwarded-For": "198.51.100.2",
      });
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get("retry-after")) > 0);
      const key =
        "checkout-rate:" +
        createHmac(
          "sha256",
          process.env.CHECKOUT_IDENTITY_SECRET ||
            "freshcart-local-demo-identity-only",
        )
          .update("127.0.0.1")
          .digest("hex");
      await writeEntity(key, { count: 2, expires: Date.now() - 1 });
      assert.equal((await call("/orders", {})).status, 400);
      await deleteEntity(key);
      delete process.env.CHECKOUT_RATE_MAX;
    },
  );
  await t.test(
    "legacy settings receive defaults; custom phone rules and delivery zones are accepted, unsafe market edits rejected",
    async () => {
      const settings = await getSettings();
      await writeEntity("settings", { ...settings, profile: undefined });
      assert.deepEqual((await getSettings()).profile, defaultProfile);
      const custom = {
        ...settings,
        profile: {
          ...defaultProfile,
          name: "Local Market",
          callingCode: "1",
          nationalPrefix: "1",
          nationalStarts: [],
          nationalLengths: [10],
          country: "US",
          currency: "USD",
          timeZone: "America/New_York",
        },
        zones: [
          { name: "Brooklyn", fee: 5, enabled: true, estimate: "Pick a slot" },
        ],
      };
      assert.ok(settingsSchema.safeParse(custom).success);
      assert.equal(
        normalizePhone("(212) 555-1234", custom.profile),
        "+12125551234",
      );
      assert.equal(normalizePhone("+442071234567", custom.profile), "");
      const response = await fetch(base + "/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(custom),
      });
      assert.equal(response.status, 409);
      await saveSettings(settings);
      assert.equal(
        settingsSchema.safeParse({
          ...settings,
          profile: { ...defaultProfile, timeZone: "invalid/timezone" },
        }).success,
        false,
      );
      assert.equal(
        settingsSchema.safeParse({
          ...settings,
          profile: { ...defaultProfile, currency: "JPY" },
        }).success,
        false,
      );
      assert.equal(
        settingsSchema.safeParse({
          ...settings,
          zones: [settings.zones[0], settings.zones[0]],
        }).success,
        false,
      );
    },
  );
});
test("custom market settings drive actual API checkout and reset expiry is enforced", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-market-"));
  process.env.FRESHCART_DATA_DIR = directory;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    delete process.env.FRESHCART_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });
  const admin = await register(
    "Market Admin",
    "market-admin@example.test",
    "market-test-password",
  );
  await saveUser({ ...admin, role: "admin" });
  const signed = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: admin.email,
      password: "market-test-password",
    }),
  });
  const cookie = signed.headers.get("set-cookie")!.split(";")[0];
  const settings = await getSettings(),
    profile = {
      ...defaultProfile,
      name: "Neighborhood Market",
      currency: "USD",
      country: "US",
      callingCode: "1",
      nationalPrefix: "1",
      nationalLengths: [10],
      nationalStarts: [],
      city: "New York",
      timeZone: "America/New_York",
    };
  const custom = {
    ...settings,
    profile,
    zones: [
      {
        name: "Brooklyn",
        enabled: true,
        fee: 5,
        estimate: "Choose a delivery slot",
      },
    ],
  };
  const saved = await fetch(base + "/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(custom),
  });
  assert.equal(saved.status, 200);
  const storefront = await (await fetch(base + "/storefront")).json();
  assert.equal(storefront.settings.profile.currency, "USD");
  assert.equal(storefront.payments.enabled, false);
  const input = {
    customer: {
      name: "US Demo",
      phone: "(212) 555-1234",
      address: "Demo house 12, Brooklyn",
      area: "Brooklyn",
    },
    items: [{ productId: "banana", quantity: 1 }],
    payment: "cash-on-delivery",
    acceptedTerms: true,
    instructions: "",
    requestId: randomUUID(),
    accessToken: randomUUID(),
    deliverySelection: {
      date: deliveryDays(new Date(), profile.timeZone)[1].date,
      slot: "afternoon",
    },
  };
  const orderResponse = await fetch(base + "/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assert.equal(orderResponse.status, 201);
  const result = await orderResponse.json();
  assert.equal(result.order.currency, "USD");
  assert.equal(result.order.timeZone, profile.timeZone);
  assert.equal(result.total, 75);
  const invalid = await fetch(base + "/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      requestId: randomUUID(),
      accessToken: randomUUID(),
      customer: { ...input.customer, phone: "01712345678" },
    }),
  });
  assert.equal(invalid.status, 400);
  const { digest } = await import("../server/auth");
  const token = "a".repeat(64);
  await saveUser({
    ...admin,
    role: "admin",
    resetHash: digest(token),
    resetExpires: Date.now() - 1,
  });
  const expired = await fetch(base + "/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: admin.email,
      token,
      password: "new-test-password",
    }),
  });
  assert.equal(expired.status, 400);
});
test("explicit production prerequisites, trusted proxies and daylight-saving delivery clocks", () => {
  assert.equal(
    validateRuntime({ STORE_MODE: "demo", TRUSTED_PROXY_CIDRS: "" }),
    "demo",
  );
  assert.equal(
    validateRuntime({ STORE_MODE: "demo", TRUSTED_PROXY_CIDRS: "   " }),
    "demo",
  );
  assert.throws(
    () => validateRuntime({ NODE_ENV: "production" }),
    /STORE_MODE/,
  );
  assert.throws(
    () => validateRuntime({ STORE_MODE: "production" }),
    /MONGODB_URI/,
  );
  const env = {
    STORE_MODE: "production",
    MONGODB_URI: "mongodb://unused-test",
    WEB_ORIGIN: "https://store.example.test",
    PUBLIC_API_URL: "https://api.example.test",
    CHECKOUT_IDENTITY_SECRET: "x".repeat(32),
  };
  assert.equal(validateRuntime(env), "production");
  for (const proxy of ["true", "1", "0.0.0.0/99", "garbage"])
    assert.throws(
      () => validateRuntime({ ...env, TRUSTED_PROXY_CIDRS: proxy }),
      /proxy IP/,
    );
  assert.equal(
    validateRuntime({ ...env, TRUSTED_PROXY_CIDRS: "127.0.0.1/32,::1/128" }),
    "production",
  );
  assert.equal(
    localInstant("2026-01-10", "10:00", "America/New_York").toISOString(),
    "2026-01-10T15:00:00.000Z",
  );
  assert.equal(
    localInstant("2026-07-10", "10:00", "America/New_York").toISOString(),
    "2026-07-10T14:00:00.000Z",
  );
  assert.equal(
    deliveryDays(
      new Date("2026-07-10T13:30:00Z"),
      "America/New_York",
    )[0].slots.some((s) => s.id === "morning"),
    false,
  );
});
test("browser attempt persists across reload and is isolated by account", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) || null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
    },
  });
  try {
    const attempt = {
      owner: "guest",
      createdAt: Date.now() - 86400001,
      payload: '{"items":[]}',
      requestId: randomUUID(),
      accessToken: randomUUID(),
    };
    const changed = prepareCheckoutAttempt("guest", "changed basket", attempt);
    assert.equal(changed.requestId, attempt.requestId);
    assert.equal(changed.accessToken, attempt.accessToken);
    saveCheckoutAttempt({ ...attempt, owner: "another-account" });
    saveCheckoutAttempt(attempt);
    assert.deepEqual(readCheckoutAttempt("guest"), attempt);
    assert.equal(readCheckoutAttempt("unrelated-account"), null);
    forgetCheckoutAttempt();
    assert.equal(readCheckoutAttempt("guest"), null);
    assert.equal(
      readCheckoutAttempt("another-account")?.owner,
      "another-account",
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
