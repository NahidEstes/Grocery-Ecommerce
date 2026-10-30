// Run: node --import tsx scripts/verify-admin-workspace.mjs
// Requires the normal-mode web server (default port 3000), plus Playwright.
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
const output = "artifacts/admin-workspace";
await mkdir(output, { recursive: true });
const errors = [],
  forbidden = [],
  checks = [];
const mark = (value) => {
  checks.push(value);
  console.log(`PASS ${value}`);
};
async function contextFor(role, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
  });
  const login = await context.request.post(`${fixture.base}/api/auth/login`, {
    data: {
      email: `${role}@workspace.example.test`,
      password: fixture.password,
    },
    headers: { Origin: base },
  });
  assert.equal(login.status(), 200);
  // Only the test browser's API requests reach the isolated real Express API.
  // The user's running store and its accounts/orders are never mutated.
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    try {
      const response = await route.fetch({
        url: `${fixture.base}${url.pathname}${url.search}`,
      });
      if (response.status() >= 500)
        errors.push(
          `${request.method()} ${url.pathname}: ${response.status()}`,
        );
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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /\/api\/admin\/(team|purchasing|returns|orders)/.test(request.url()) &&
      role === "editor"
    )
      forbidden.push(request.url());
    if (
      /\/api\/admin\/(team|purchasing|returns|.*finance)/.test(request.url()) &&
      role === "fulfilment"
    )
      forbidden.push(request.url());
  });
  return { context, page };
}
async function layout(page) {
  assert.equal(
    await page
      .locator(".header,.footer,.mobile-bottom-nav,.mobile-navigation")
      .count(),
    0,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "page overflow",
  );
}
try {
  for (const width of [1440, 390]) {
    await fixture.resetOrders();
    const { context, page } = await contextFor("admin", width);
    await page.goto(`${base}/admin`);
    await page.locator(".workspace-welcome").waitFor();
    await page.locator(".workspace-task").last().waitFor();
    await layout(page);
    await page.screenshot({
      path: `${output}/overview-${width}.png`,
      fullPage: true,
    });
    if (width === 1440) {
      await page
        .getByRole("button", { name: "Collapse sidebar", exact: true })
        .click();
      assert.ok(await page.locator(".workspace-shell.is-compact").count());
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .click();
    }
    await page
      .locator(".workspace-task")
      .filter({ hasText: "New orders" })
      .click();
    await page.locator(".workspace-orders-table").waitFor();
    assert.equal(
      await page.locator(".workspace-orders-table tbody tr").count(),
      4,
    );
    await page.getByRole("button", { name: /All orders/ }).click();
    await page
      .getByRole("textbox", { name: "Search orders", exact: true })
      .fill("FC-AB001001");
    await page
      .getByRole("button", { name: "View order FC-AB001001", exact: true })
      .click();
    const detail = page.getByRole("dialog", {
      name: "Order FC-AB001001",
      exact: true,
    });
    await detail.waitFor();
    assert.ok((await detail.innerText()).includes("Cash on delivery"));
    await detail
      .getByRole("button", { name: "Start preparing", exact: true })
      .click();
    await detail
      .getByRole("button", { name: "Confirm status change", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".workspace-detail-meta .workspace-status")
          ?.textContent === "Preparing",
    );
    await detail
      .getByText("Batch picking, notes, history & printing", { exact: true })
      .click();
    await detail
      .getByRole("textbox", { name: "Internal note for FC-AB001001" })
      .fill(`Packed for isolated QA review (${width}px).`);
    await detail
      .getByRole("button", { name: "Save note", exact: true })
      .click();
    await detail
      .getByText(`Packed for isolated QA review (${width}px).`, { exact: true })
      .waitFor();
    await page.screenshot({
      path: `${output}/order-detail-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page
      .getByRole("button", { name: "Clear order search", exact: true })
      .click();
    await page.getByRole("button", { name: "Filters", exact: false }).click();
    await page
      .getByRole("combobox", { name: "Filter payment status" })
      .selectOption("paid");
    assert.equal(
      await page.locator(".workspace-orders-table tbody tr").count(),
      8,
    );
    await page
      .getByRole("button", { name: "Clear filters", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Next orders page", exact: true })
      .click();
    assert.equal(
      await page.locator(".workspace-orders-table tbody tr").count(),
      6,
    );
    await page.getByText("Not scheduled", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Previous orders page", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search orders", exact: true })
      .fill("nothing-matches");
    await page
      .getByRole("heading", { name: "No orders match these filters" })
      .waitFor();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .last()
      .click();
    const filterButton = page.getByRole("button", {
      name: "Filters",
      exact: false,
    });
    if ((await filterButton.getAttribute("aria-expanded")) === "true")
      await filterButton.click();
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await layout(page);
    await page.screenshot({
      path: `${output}/orders-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page.getByRole("button", { name: "Open admin navigation" }).click();
      await page
        .getByRole("dialog", { name: "Administration", exact: true })
        .waitFor();
      await page
        .getByRole("textbox", { name: "Search administration menu" })
        .fill("products");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Products & stock", exact: true })
        .click();
    } else {
      await page
        .locator(".workspace-sidebar")
        .getByRole("button", { name: "Products & stock", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .waitFor();
    await page
      .locator(".admin-table tbody tr")
      .first()
      .getByRole("button", { name: /^Edit / })
      .click();
    await page.locator('input[name="name"]').fill("Unsaved QA draft");
    if (width === 390) {
      await page.getByRole("button", { name: "Open admin navigation" }).click();
      await page
        .getByRole("textbox", { name: "Search administration menu" })
        .fill("orders");
      await page
        .getByRole("dialog", { name: "Administration", exact: true })
        .getByRole("button", { name: "Orders", exact: true })
        .click();
    } else
      await page
        .locator(".workspace-sidebar")
        .getByRole("button", { name: "Orders", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    assert.equal(
      await page.locator('input[name="name"]').inputValue(),
      "Unsaved QA draft",
    );
    mark(
      `${width}px: grouped navigation, overview tasks, orders search/filter/pagination, detail drawer, real status update/history note, unsaved draft guard, responsive layout`,
    );
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  }
  for (const role of ["manager", "editor", "fulfilment", "customer"]) {
    console.log(`CHECK ${role}`);
    const { context, page } = await contextFor(role);
    await page.goto(`${base}/admin?section=team`);
    if (role === "customer") {
      await page
        .getByText("Your account does not have administrator access.", {
          exact: true,
        })
        .waitFor();
    } else {
      await page.locator(".workspace-shell").waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Staff & permissions", exact: true })
          .count(),
        0,
      );
      if (role === "manager")
        await page.locator(".workspace-welcome").waitFor();
      if (role === "editor") await page.locator(".admin-table").waitFor();
      if (role === "editor")
        assert.equal(
          await page
            .getByRole("button", { name: "Orders", exact: true })
            .count(),
          0,
        );
      if (role === "fulfilment") {
        await page
          .getByRole("button", { name: "View order FC-AB001001", exact: true })
          .click();
        assert.equal(
          await page
            .getByText("Payment reconciliation & external refunds", {
              exact: true,
            })
            .count(),
          0,
        );
      }
    }
    const finance = await context.request.get(
      `${fixture.base}/api/admin/orders/FC-AB001001/finance`,
    );
    if (role === "editor" || role === "fulfilment" || role === "customer")
      assert.equal(finance.status(), 403);
    mark(
      `${role}: existing navigation/data/finance permission boundaries retained`,
    );
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  }
  assert.deepEqual(forbidden, []);
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(
      {
        checks,
        errors,
        forbidden,
        backend:
          "Original Express API with temporary isolated fixture data; browser-only API proxy",
        userDataMutated: false,
      },
      null,
      2,
    ),
  );
  await unlink(`${output}/failure.json`).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ error: error.stack, checks, errors, forbidden }, null, 2),
  );
  throw error;
} finally {
  for (const context of browser.contexts())
    await context.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  await fixture.close();
}
