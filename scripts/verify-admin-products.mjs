// Real Express API, disposable fixture only. No writes reach the running store.
// ADMIN_QA_URL=http://127.0.0.1:3381 node --import tsx scripts/verify-admin-products.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { startAdminFixture } from "./admin-workspace-fixture.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const base = process.env.ADMIN_QA_URL || "http://127.0.0.1:3000";
const fixture = await startAdminFixture(base),
  browser = await chromium.launch({ headless: true });
const output = "artifacts/admin-products",
  checks = [],
  errors = [];
await mkdir(output, { recursive: true });
const mark = (value) => {
  checks.push(value);
  console.log(`PASS ${value}`);
};
async function create(role, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const login = await context.request.post(`${fixture.base}/api/auth/login`, {
    data: {
      email: `${role}@workspace.example.test`,
      password: fixture.password,
    },
    headers: { Origin: base },
  });
  assert.equal(login.status(), 200);
  let releaseUpload, uploadStarted;
  const started = new Promise((resolve) => {
    uploadStarted = resolve;
  });
  const hold = new Promise((resolve) => {
    releaseUpload = resolve;
  });
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    try {
      if (
        url.pathname === "/api/admin/media" &&
        route.request().method() === "POST"
      ) {
        uploadStarted();
        await hold;
      }
      const response = await route.fetch({
        url: `${fixture.base}${url.pathname}${url.search}`,
      });
      if (response.status() >= 500)
        errors.push(`${url.pathname} ${response.status()}`);
      await route.fulfill({ response });
    } catch (error) {
      if (
        !/Route is already handled|Target.*closed|Request context disposed|Request.*aborted/.test(
          String(error),
        )
      )
        throw error;
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/409 \(Conflict\)/.test(m.text()))
      errors.push(m.text());
  });
  return { context, page, releaseUpload, started };
}
async function catalog(context) {
  return (
    await (
      await context.request.get(`${fixture.base}/api/admin/overview`)
    ).json()
  ).products;
}
async function healthyLayout(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "page overflows viewport",
  );
}
async function screenshot(page, name) {
  await page.evaluate(async () => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
}
async function tab(page, name) {
  await page.getByRole("tab", { name, exact: false }).click();
}
async function save(page) {
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page
    .getByRole("heading", { name: "Products & stock", exact: true })
    .waitFor();
}
async function discard(page) {
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Products & stock", exact: true })
    .waitFor();
}
try {
  for (const width of [1440, 390]) {
    const { context, page, started, releaseUpload } = await create(
      "admin",
      width,
    );
    await page.goto(`${base}/admin?section=products`);
    await page
      .getByRole("heading", { name: "Products & stock", exact: true })
      .waitFor();
    const original = await catalog(context);
    assert.equal(
      await page.locator(".product-catalog-table tbody tr").count(),
      Math.min(12, original.length),
    );
    if (original.length > 12) {
      await page
        .getByRole("button", { name: "Next products page", exact: true })
        .click();
      assert.ok(
        (await page.locator(".workspace-pagination").innerText()).includes(
          "2 /",
        ),
      );
      await page
        .getByRole("button", { name: "Previous products page", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("Filter product stock").selectOption("low");
    assert.ok(await page.locator(".product-catalog-table tbody tr").count());
    await page.getByLabel("Filter product category").selectOption("fruits");
    await page.getByLabel("Find products").fill("apple");
    assert.equal(
      await page.locator(".product-catalog-table tbody tr").count(),
      1,
    );
    await page.getByLabel("Find products").fill("no-such-qa-item");
    await page
      .getByRole("heading", {
        name: "No products match these filters",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .last()
      .click();
    await healthyLayout(page);
    await screenshot(page, `products-${width}`);
    mark(
      `${width}px: catalog search, combined filters, empty state and pagination`,
    );

    // Create a variant through the unchanged PUT endpoint.
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page.locator(".product-error-summary").waitFor();
    assert.equal(
      await page
        .locator("#product-field-id")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    assert.ok(await page.locator("#product-field-id").isVisible());
    const name = `QA Garden Pack ${width}`,
      id = `qa-garden-pack-${width}`;
    await page.locator('[name="name"]').fill(name);
    assert.equal(await page.locator('[name="id"]').inputValue(), id);
    await page.locator('[name="unit"]').fill("500 g");
    await tab(page, "Pricing");
    await page.locator('[name="price"]').fill("50");
    await page.locator('[name="originalPrice"]').fill("40");
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByText("The original price must be at least the selling price.", {
        exact: true,
      })
      .last()
      .waitFor();
    assert.equal(
      (await catalog(context)).some((p) => p.id === id),
      false,
    );
    await page.locator('[name="originalPrice"]').fill("60");
    await page.locator('[name="measure"]').fill("0.5");
    await tab(page, "Stock & variants");
    await page.locator('[name="stock"]').fill("12");
    await page.locator('[name="lowStockThreshold"]').fill("0");
    await page.locator('[name="changeReason"]').fill("Isolated QA stock count");
    await page.getByLabel("Variant of", { exact: false }).selectOption("apple");
    await tab(page, "Photos & details");
    const upload = page.locator('.image-upload-field input[type="file"]');
    await upload.setInputFiles({
      name: "too-large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    });
    await page
      .getByText("Choose a PNG, JPEG or WebP image under 2 MB.", {
        exact: true,
      })
      .waitFor();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await upload.setInputFiles({
      name: "qa-photo.png",
      mimeType: "image/png",
      buffer: png,
    });
    await started;
    assert.equal(
      await page
        .locator('.product-save-bar button[type="submit"]')
        .isDisabled(),
      true,
    );
    releaseUpload();
    await page.waitForFunction(() =>
      document
        .querySelector("#product-field-imageUrl")
        ?.value.startsWith("/api/media/"),
    );
    await tab(page, "বাংলা content");
    await page
      .getByLabel("Product name বাংলা", { exact: true })
      .fill(`বাগানের প্যাক ${width}`);
    await healthyLayout(page);
    await screenshot(page, `editor-language-${width}`);
    await tab(page, "Basics");
    assert.equal(await page.locator('[name="name"]').inputValue(), name);
    if (width === 390) {
      assert.equal(
        await page
          .locator('[name="name"]')
          .evaluate((e) => getComputedStyle(e).fontSize),
        "16px",
      );
      await page.getByText("Preview your product", { exact: true }).click();
      await page
        .locator(".product-preview-mobile")
        .getByRole("button", { name: "বাংলা", exact: true })
        .click();
      await page
        .locator(".product-preview-mobile")
        .getByRole("heading", { name: `বাগানের প্যাক ${width}`, exact: true })
        .waitFor();
    }
    await screenshot(page, `editor-basics-${width}`);
    await tab(page, "Pricing");
    await healthyLayout(page);
    await screenshot(page, `editor-pricing-${width}`);
    const saveButton = page.locator('.product-save-bar button[type="submit"]');
    const size = await saveButton.boundingBox();
    assert.ok(
      size && size.height >= 44 && size.y + size.height <= 900,
      "save button stays available above bottom edge",
    );
    // Arrow keys move focus and selection across tabs without losing values.
    await page.getByRole("tab", { name: "Pricing", exact: false }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page
        .getByRole("tab", { name: "Stock & variants", exact: false })
        .getAttribute("aria-selected"),
      "true",
    );
    await save(page);
    const saved = (await catalog(context)).find((p) => p.id === id);
    assert.equal(saved.lowStockThreshold, 0);
    assert.equal(saved.price, 50);
    assert.equal(saved.stock, 12);
    assert.equal(saved.parentId, "apple");
    assert.equal(saved.translations.bn.name.source, name);
    assert.equal(saved.translations.bn.name.text, `বাগানের প্যাক ${width}`);
    assert.match(saved.imageUrl, /^\/api\/media\//);
    assert.equal(saved.version, 1);
    const stock = await (
      await context.request.get(`${fixture.base}/api/admin/inventory`)
    ).json();
    assert.ok(
      stock.events.some(
        (e) => e.productId === id && e.reason === "Isolated QA stock count",
      ),
    );
    await page.getByLabel("Find products").fill(`বাগানের প্যাক ${width}`);
    assert.equal(
      await page.locator(".product-catalog-table tbody tr").count(),
      1,
    );
    mark(
      `${width}px: guided create, focused validation, upload guard, real upload, pack variants, zero threshold, Bangla source and stock audit persisted`,
    );

    await page
      .getByRole("button", { name: `Edit ${name} (500 g)`, exact: true })
      .click();
    assert.equal(
      await page.locator('[name="id"]').getAttribute("readonly"),
      "",
    );
    await page.locator('[name="name"]').fill(`${name} updated`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    assert.equal(
      await page.locator('[name="name"]').inputValue(),
      `${name} updated`,
    );
    await tab(page, "বাংলা content");
    await page
      .getByText(
        "English changed. Review this translation before publishing.",
        { exact: true },
      )
      .waitFor();
    await save(page);
    const changed = (await catalog(context)).find((p) => p.id === id);
    assert.equal(changed.version, 2);
    assert.equal(
      changed.translations.bn.name.source,
      name,
      "saving English must not approve a stale translation",
    );
    await page.getByLabel("Find products").fill(id);
    await page
      .getByRole("button", {
        name: `Edit ${name} updated (500 g)`,
        exact: true,
      })
      .click();
    await tab(page, "বাংলা content");
    await page
      .getByRole("button", { name: "Confirm this translation", exact: true })
      .click();
    await save(page);
    const confirmed = (await catalog(context)).find((p) => p.id === id);
    assert.equal(confirmed.translations.bn.name.source, `${name} updated`);
    await page.getByLabel("Find products").fill(id);
    await page
      .getByRole("button", {
        name: `Edit ${name} updated (500 g)`,
        exact: true,
      })
      .click();
    await page.locator('[name="name"]').fill("My retained conflicting draft");
    const response = await context.request.put(
      `${fixture.base}/api/admin/products/${id}`,
      { headers: { Origin: base }, data: { ...confirmed, stock: 13 } },
    );
    assert.equal(response.status(), 200);
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByText("We couldn’t save this product.", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator('[name="name"]').inputValue(),
      "My retained conflicting draft",
    );
    assert.equal(
      (await catalog(context)).find((p) => p.id === id).name,
      `${name} updated`,
    );
    await discard(page);
    await healthyLayout(page);
    mark(
      `${width}px: unsaved cancellation guard, stale translation review, optimistic version conflict retains draft`,
    );
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  }
  for (const width of [320, 768]) {
    const { context, page } = await create("admin", width);
    await page.goto(`${base}/admin?section=products`);
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    for (const name of [
      "Basics",
      "Pricing",
      "Stock & variants",
      "Photos & details",
      "বাংলা content",
    ]) {
      await tab(page, name);
      await healthyLayout(page);
    }
    await page
      .getByRole("button", { name: "Open admin navigation", exact: true })
      .click();
    const nav = page.getByRole("dialog", {
      name: "Administration",
      exact: true,
    });
    await nav.waitFor();
    await nav.getByRole("button", { name: "Orders", exact: true }).click();
    await page.locator(".workspace-orders-table").waitFor();
    await healthyLayout(page);
    mark(
      `${width}px: every product section, touch navigation and Orders fit viewport`,
    );
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  }
  for (const role of ["editor", "fulfilment", "customer"]) {
    const { context, page } = await create(role, 390);
    const requests = [];
    page.on("request", (r) => {
      if (/\/api\/admin\/(team|purchasing|returns|orders)/.test(r.url()))
        requests.push(r.url());
    });
    await page.goto(`${base}/admin?section=products`);
    if (role === "editor") {
      await page
        .getByRole("button", { name: "Add product", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Add a product", exact: true })
        .waitFor();
      assert.deepEqual(requests, []);
    } else {
      if (role === "customer")
        await page
          .getByText("Your account does not have administrator access.", {
            exact: true,
          })
          .waitFor();
      else await page.locator(".workspace-orders-table").waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Add product", exact: true })
          .count(),
        0,
      );
      const denied = await context.request.put(
        `${fixture.base}/api/admin/products/blocked-qa`,
        { headers: { Origin: base }, data: {} },
      );
      assert.equal(denied.status(), 403);
    }
    mark(`${role}: existing product permission boundaries retained`);
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(
      {
        checks,
        errors,
        userDataMutated: false,
        backend: "Original Express API, temporary isolated fixture",
      },
      null,
      2,
    ),
  );
  for (const name of ["failure.json", "failure.png"])
    await unlink(`${output}/${name}`).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page
        .screenshot({ path: `${output}/failure.png`, fullPage: true })
        .catch(() => {});
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ error: error.stack, checks, errors }, null, 2),
  );
  throw error;
} finally {
  for (const context of browser.contexts())
    await context.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  await fixture.close();
}
