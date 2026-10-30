// Optional browser QA. Install Playwright separately; it is not a runtime dependency.
// Run after NEXT_PUBLIC_BROWSER_DEMO=true npm run build. See DEMO-VERCEL.md.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
  unlink,
} from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const prefix = "freshcart-browser-demo:usa-usd:v1:",
  port = Number(process.env.DEMO_QA_PORT || 3377),
  base = `http://127.0.0.1:${port}`;
const outputDir = "artifacts/browser-demo";
await mkdir(outputDir, { recursive: true });
const requests = [],
  errors = [],
  failures = [],
  checks = [];
const trap = createServer((req, res) => {
  requests.push(`SERVER ${req.url}`);
  res.writeHead(503).end();
});
await new Promise((resolve) => trap.listen(0, "127.0.0.1", resolve));
const trapPort = trap.address().port;
async function dataSnapshot(directory = ".data") {
  try {
    const result = [];
    for (const file of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, file.name);
      if (file.isDirectory()) result.push(...(await dataSnapshot(filename)));
      else {
        const info = await stat(filename);
        result.push([filename, info.size, info.mtimeMs]);
      }
    }
    return result;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
const before = await dataSnapshot();
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    // Intentionally start a true-built artifact with the flag false: both rendering
    // sides must retain the compiled mode, independent of runtime env changes.
    env: {
      ...process.env,
      NEXT_PUBLIC_BROWSER_DEMO: "false",
      API_URL: `http://127.0.0.1:${trapPort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverLog = "";
server.stdout.on("data", (chunk) => {
  serverLog += chunk;
});
server.stderr.on("data", (chunk) => {
  serverLog += chunk;
});
let browser;
const mark = (text) => {
  checks.push(text);
  console.log(`PASS ${text}`);
};
const normal = {
  "freshcart-cart": '[{"productId":"apple","quantity":20}]',
  "freshcart-orders": "normal-BDT-orders",
  "freshcart-addresses": "normal-BD-addresses",
  "other-app": "keep",
};
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/") ||
      (url.origin !== base && url.protocol.startsWith("http"))
    )
      requests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    if (!request.failure()?.errorText.includes("ERR_ABORTED"))
      failures.push(`${request.url()} ${request.failure()?.errorText}`);
  });
}
async function clean(page) {
  const text = await page.locator("body").innerText();
  assert.doesNotMatch(
    text,
    /৳|\+880|Dhaka|Dhanmondi|Mirpur|Uttara|Gulshan|Bangladesh|GMT\+6|bKash|ঢাকা|ধানমন্ডি|মিরপুর|বাংলাদেশ/i,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "horizontal overflow",
  );
}
async function ready(page) {
  if (new URL(page.url()).pathname.startsWith("/admin")) {
    await page.locator(".demo-admin").waitFor();
    return;
  }
  await page.locator(".language-switcher select:not([disabled])").waitFor();
}
try {
  for (
    let i = 0;
    i < 100 && !serverLog.includes("Ready") && server.exitCode === null;
    i++
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(serverLog.includes("Ready"), serverLog);
  const rewrites = JSON.parse(
    await readFile(".next/routes-manifest.json", "utf8"),
  ).rewrites;
  assert.ok(
    !JSON.stringify(rewrites).includes("/api/"),
    "demo build has API rewrite",
  );
  const raw = await fetch(base);
  assert.equal(raw.status, 200);
  const html = await raw.text();
  assert.ok(html.includes("USD") && html.includes("Interactive demo"));
  mark(
    "Compiled flag stays consistent for SSR/client; demo rewrites are empty",
  );
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    const page = await context.newPage();
    watch(page);
    await page.goto(base);
    await ready(page);
    await page.evaluate((values) => {
      for (const [key, value] of Object.entries(values))
        localStorage.setItem(key, value);
    }, normal);
    await page.reload();
    await ready(page);
    assert.equal(await page.locator(".cart-count").innerText(), "0");
    await clean(page);
    await page.screenshot({
      path: `${outputDir}/home-${width}.png`,
      fullPage: true,
    });
    await page.locator(".language-switcher select").selectOption("bn");
    await page.locator(".smart-search input").fill("আপেল");
    await page.locator(".smart-search input").press("Enter");
    await page.waitForURL(/\/products\?q=/);
    await page.locator(".product-card").first().waitFor();
    await page.locator('a[href="/products/apple-fuji"]').first().click();
    await page.waitForURL(/\/products\/apple-fuji$/);
    await page.locator(".pack-size").selectOption("apple-500g");
    assert.ok(
      (await page.locator(".detail-prices").innerText()).includes("$3.29"),
    );
    await page.locator(".wishlist-button").click();
    await page.locator(".purchase-actions .primary").click();
    await page.goto(`${base}/cart`);
    await ready(page);
    await page.locator(".cart-table .quantity-control").first().waitFor();
    // Quantity controls work in either language.
    await page
      .locator(".cart-table .quantity-control")
      .first()
      .locator("button")
      .last()
      .click();
    await page.waitForFunction(
      (prefix) =>
        JSON.parse(localStorage.getItem(`${prefix}cart`))[0].quantity === 2,
      prefix,
    );
    await page.reload();
    await ready(page);
    await page.locator("#promo-code").waitFor();
    assert.ok(
      (await page.locator(".cart-table").innerText()).includes("$6.58"),
    );
    assert.deepEqual(
      await page.evaluate(
        (prefix) => JSON.parse(localStorage.getItem(`${prefix}saved`)),
        prefix,
      ),
      ["apple-500g"],
    );
    await page.goto(`${base}/products/fresh-milk`);
    await ready(page);
    await page.locator(".purchase-actions .primary").click();
    await page.locator('a[href="/cart"]').first().click();
    await page.waitForURL(/\/cart$/);
    const milk = page
      .locator(".cart-row")
      .filter({ has: page.locator('a[href="/products/fresh-milk"]') });
    await milk.locator(".remove-item").click();
    await page.waitForFunction(
      (prefix) =>
        JSON.parse(localStorage.getItem(`${prefix}cart`)).length === 1,
      prefix,
    );
    if (width === 390)
      await page.locator(".language-switcher select").selectOption("en");
    await page.locator("#promo-code").fill("FRESH10");
    await page.locator('.promo-form button[type="submit"]').click();
    for (const [city, total] of [
      ["Chicago, IL", "$9.91"],
      ["Los Angeles, CA", "$11.91"],
      ["New York, NY", "$10.91"],
    ]) {
      await page.locator(".demo-city-picker select").selectOption(city);
      await page.waitForFunction(
        (total) =>
          document
            .querySelector(".order-summary .grand-total")
            ?.textContent.includes(total),
        total,
      );
    }
    if (width === 1440) {
      await page.locator(".location-button").click();
      assert.ok(
        (await page.locator(".area-options").innerText()).includes(
          "America/Chicago",
        ),
      );
      await page
        .locator(".area-options button")
        .filter({ hasText: "Chicago, IL" })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".order-summary .grand-total")
          ?.textContent.includes("$9.91"),
      );
      await page
        .locator(".demo-city-picker select")
        .selectOption("New York, NY");
    }
    await page.locator(".checkout-button").click();
    await page.waitForURL(/\/checkout/);
    await page.locator('select[name="city"]').waitFor();
    const cities = [
      ["New York, NY", "America/New_York", "$10.91"],
      ["Chicago, IL", "America/Chicago", "$9.91"],
      ["Los Angeles, CA", "America/Los_Angeles", "$11.91"],
    ];
    for (const [city, zone, total] of cities) {
      await page.locator('select[name="city"]').selectOption(city);
      await page.waitForFunction(
        (zone) =>
          document
            .querySelector(".demo-checkout-grid")
            ?.textContent.includes(zone),
        zone,
      );
      assert.ok(
        (await page.locator(".grand-total").innerText()).includes(total),
      );
      assert.equal(
        await page.locator('input[name="state"]').inputValue(),
        city.split(", ")[1],
      );
      await page.locator('.demo-slots input[type="radio"]').first().check();
      await clean(page);
    }
    await page.screenshot({
      path: `${outputDir}/checkout-${width}.png`,
      fullPage: true,
    });
    await page.locator(".demo-agreement input").check();
    await page.locator('.checkout-form button[type="submit"]').click();
    await page.waitForURL(/\/orders\/DEMO-/);
    await page.locator(".demo-reference").waitFor();
    const receiptUrl = page.url(),
      reference = await page.locator(".demo-reference").innerText();
    await page.reload();
    await ready(page);
    await page.getByText(reference, { exact: true }).waitFor();
    assert.ok((await page.locator("body").innerText()).includes("$11.91"));
    await clean(page);
    await page.screenshot({
      path: `${outputDir}/receipt-${width}.png`,
      fullPage: true,
    });
    const saved = await page.evaluate(
      (prefix) => JSON.parse(localStorage.getItem(`${prefix}orders`)),
      prefix,
    );
    assert.equal(saved[0].currency, "USD");
    assert.equal(saved[0].timeZone, "America/Los_Angeles");
    assert.equal(saved[0].customer.name, "Alex Example");
    await page.goto(`${base}/cart`);
    await ready(page);
    assert.equal(await page.locator(".cart-count").innerText(), "0");
    for (const route of [
      "/recipes",
      "/recipes/garden-crunch-salad",
      "/products?sort=price-asc&maxPrice=5",
      "/products?page=2",
      "/products?q=unmatched-query-xyz",
      "/account",
      "/lists",
      "/admin/print/DEMO-SAMPLE-1",
    ]) {
      await page.goto(`${base}${route}`);
      await ready(page);
      await clean(page);
    }
    await page.goto(`${base}/admin`);
    await ready(page);
    for (let i = 0; i < 4; i++) {
      await page.locator(".demo-admin-tabs button").nth(i).click();
      await clean(page);
    }
    assert.equal(
      await page
        .locator(
          '.demo-admin input, .demo-admin select, .demo-admin input[type="file"]',
        )
        .count(),
      0,
    );
    await page.screenshot({
      path: `${outputDir}/admin-${width}.png`,
      fullPage: true,
    });
    await page.goto(receiptUrl);
    await page.locator(".demo-reference").waitFor();
    await page.locator(".browser-demo-banner button").first().click();
    await page.waitForFunction(
      () => !document.querySelector(".demo-reference"),
    );
    for (const [key, value] of Object.entries(normal))
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), key),
        value,
      );
    assert.equal(
      await page.evaluate(
        (prefix) => localStorage.getItem(`${prefix}orders`),
        prefix,
      ),
      null,
    );
    mark(
      `${width}px: বাংলা/English search, variant, favourite, add/remove/quantity, reload, promo, city pickers, 3 cities, checkout, receipt reload, read-only admin, scoped reset`,
    );
    await context.close();
  }
  for (const blocked of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(
      ({ prefix, blocked }) => {
        if (blocked) {
          for (const name of ["localStorage", "sessionStorage"])
            Object.defineProperty(window, name, {
              configurable: true,
              get() {
                throw new DOMException("Blocked", "SecurityError");
              },
            });
        } else {
          for (const key of ["cart", "saved", "orders"])
            localStorage.setItem(`${prefix}${key}`, "{invalid");
        }
      },
      { prefix, blocked },
    );
    const page = await context.newPage();
    watch(page);
    await page.goto(`${base}/products/apple-fuji`);
    await ready(page);
    await page.locator(".purchase-actions .primary").click();
    // Client navigation preserves in-memory state with unavailable storage.
    await page.locator('a[href="/cart"]').first().click();
    await page.waitForURL(/\/cart$/);
    await page.locator(".checkout-button").click();
    await page.locator(".demo-agreement input").check();
    await page.locator('.checkout-form button[type="submit"]').click();
    await page.waitForURL(/\/orders\/DEMO-/);
    await page.locator(".demo-reference").waitFor();
    await clean(page);
    if (blocked)
      assert.ok(
        (await page.locator(".browser-demo-banner").innerText()).includes(
          "Browser storage is unavailable",
        ),
      );
    await page.locator(".browser-demo-banner button").first().click();
    await page.waitForFunction(
      () => !document.querySelector(".demo-reference"),
    );
    mark(
      `${blocked ? "Blocked" : "Corrupt"} storage: shopping and receipt work without crashing; reset clears session`,
    );
    await context.close();
  }
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(await dataSnapshot(), before);
  const cacheContext = await browser.newContext();
  const cachePage = await cacheContext.newPage();
  watch(cachePage);
  await cachePage.goto(base);
  await ready(cachePage);
  await cachePage.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const allowed = [
      "/offline.html",
      "/icons/freshcart-192.png",
      "/icons/freshcart-512.png",
      "/icons/freshcart-maskable.png",
    ];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys()) {
        if (!allowed.includes(new URL(request.url).pathname))
          throw new Error(`Unexpected cached response: ${request.url}`);
      }
  });
  await cacheContext.close();
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  mark(
    "Zero client/API/localhost backend requests, console errors, hydration errors or .data writes",
  );
  mark(
    "Active PWA worker caches only offline shell/icons; no customer/demo pages or responses",
  );
  // Deliberate HTTP probes: the browser never calls these, and there is no API proxy.
  for (const route of ["/api/health", "/api/admin/orders", "/api/orders"]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 404);
    assert.notEqual(
      response.headers.get("X-FreshCart-Service"),
      "freshcart-api",
    );
  }
  mark("Demo deployment exposes no Express API endpoints (404)");
  await writeFile(
    `${outputDir}/verification.json`,
    JSON.stringify(
      { checks, requests, errors, failures, dataUnchanged: true },
      null,
      2,
    ),
  );
  await unlink(`${outputDir}/failure.json`).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
} catch (error) {
  await writeFile(
    `${outputDir}/failure.json`,
    JSON.stringify(
      { error: error.stack, checks, requests, errors, failures, serverLog },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => trap.close(resolve));
}
