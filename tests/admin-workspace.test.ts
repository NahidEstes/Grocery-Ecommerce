import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedAdminTools,
  resolveAdminSection,
  emptyOrderFilters,
  filterAdminOrders,
  nextOrderStatuses,
  adminOrderDelivery,
  adminCalendarDate,
} from "../src/lib/admin-workspace";
import { can } from "../src/lib/management";
import type { Account } from "../src/lib/storefront";
import type { Order } from "../src/lib/orders";

function order(reference: string, patch: Partial<Order> = {}): Order {
  return {
    reference,
    customer: {
      name: "Alex Example",
      phone: "+12025550142",
      address: "123 Example Lane",
      area: "New York, NY",
    },
    items: [],
    subtotal: 10,
    discount: 0,
    delivery: 0,
    total: 10,
    currency: "USD",
    timeZone: "America/New_York",
    deliverySelection: { date: "2026-11-01", slot: "morning" },
    instructions: "",
    payment: "cash-on-delivery",
    status: "placed",
    mode: "demo",
    createdAt: "2026-11-01T04:30:00Z",
    ...patch,
  };
}
test("admin workspace: grouped tools retain existing role/permission boundaries", () => {
  const roles: Account["role"][] = [
    "admin",
    "manager",
    "editor",
    "fulfilment",
    "customer",
  ];
  for (const role of roles)
    for (const tool of allowedAdminTools(role))
      assert.ok(can(role, tool.permission));
  assert.equal(allowedAdminTools("admin").length, 17);
  assert.deepEqual(
    allowedAdminTools("fulfilment").map((tool) => tool.id),
    ["orders", "support"],
  );
  assert.equal(
    allowedAdminTools("manager").some((tool) => tool.id === "team"),
    false,
  );
  assert.equal(
    allowedAdminTools("editor").some((tool) =>
      ["orders", "returns", "reports"].includes(tool.id),
    ),
    false,
  );
  assert.deepEqual(allowedAdminTools("customer"), []);
  assert.equal(resolveAdminSection("team", "manager"), "overview");
  assert.equal(resolveAdminSection("orders", "editor"), "products");
  assert.equal(resolveAdminSection("overview", "fulfilment"), "orders");
  assert.equal(resolveAdminSection("overview", undefined), null);
});
test("admin orders: search, fulfilment, payment and area filters compose without mutating source", () => {
  const orders = [
    order("NEW-1"),
    order("PAID-2", {
      payment: "online",
      paymentStatus: "paid",
      status: "preparing",
    }),
    order("REVIEW-3", {
      payment: "online",
      paymentStatus: "review",
      customer: {
        ...order("x").customer,
        area: "Chicago, IL",
        name: "Sam Sample",
      },
    }),
  ];
  const result = filterAdminOrders(
    orders,
    {
      ...emptyOrderFilters,
      status: "open",
      payment: "review",
      query: "SAM",
      area: "Chicago, IL",
    },
    "Asia/Dhaka",
  );
  assert.deepEqual(
    result.map((item) => item.reference),
    ["REVIEW-3"],
  );
  assert.equal(
    filterAdminOrders(
      orders,
      { ...emptyOrderFilters, payment: "cod" },
      "Asia/Dhaka",
    ).length,
    1,
  );
  assert.equal(
    filterAdminOrders(
      orders,
      { ...emptyOrderFilters, query: "no-such-order" },
      "Asia/Dhaka",
    ).length,
    0,
  );
  assert.deepEqual(
    orders.map((item) => item.reference),
    ["NEW-1", "PAID-2", "REVIEW-3"],
  );
});
test("admin orders: date ranges respect historic timezone and delivery queue excludes finished orders", () => {
  const orders = [
    order("NY-TODAY"),
    order("LA-YESTERDAY", { timeZone: "America/Los_Angeles" }),
    order("DONE", { status: "delivered" }),
    order("CANCELLED", { status: "cancelled" }),
  ];
  const today = filterAdminOrders(
    orders,
    { ...emptyOrderFilters, from: "2026-11-01", to: "2026-11-01" },
    "Asia/Dhaka",
  );
  assert.equal(
    today.some((item) => item.reference === "LA-YESTERDAY"),
    false,
  );
  assert.equal(
    today.some((item) => item.reference === "NY-TODAY"),
    true,
  );
  assert.deepEqual(
    filterAdminOrders(
      orders,
      { ...emptyOrderFilters, deliveryDate: "2026-11-01" },
      "Asia/Dhaka",
    ).map((item) => item.reference),
    ["NY-TODAY", "LA-YESTERDAY"],
  );
  assert.deepEqual(
    filterAdminOrders(
      orders,
      { ...emptyOrderFilters, from: "2026-11-02", to: "2026-11-01" },
      "Asia/Dhaka",
    ),
    [],
  );
});
test("admin orders: delivery sorting uses chronological slot order and preserves backend transition choices", () => {
  const orders = [
    order("EVENING", {
      deliverySelection: { date: "2026-11-01", slot: "evening" },
    }),
    order("MORNING"),
    order("AFTERNOON", {
      deliverySelection: { date: "2026-11-01", slot: "afternoon" },
    }),
  ];
  assert.deepEqual(
    filterAdminOrders(
      orders,
      { ...emptyOrderFilters, sort: "delivery" },
      "America/New_York",
    ).map((item) => item.reference),
    ["MORNING", "AFTERNOON", "EVENING"],
  );
  assert.deepEqual(nextOrderStatuses.placed, ["preparing", "cancelled"]);
  assert.deepEqual(nextOrderStatuses["out-for-delivery"], ["delivered"]);
  assert.deepEqual(nextOrderStatuses.delivered, []);
});

test("admin workspace: legacy orders without a delivery selection stay readable and are not assigned a delivery date", () => {
  const legacy = order("LEGACY");
  Reflect.deleteProperty(legacy, "deliverySelection");
  const regular = order("SCHEDULED");
  assert.equal(adminOrderDelivery(legacy), "Not scheduled");
  assert.equal(
    filterAdminOrders(
      [legacy, regular],
      { ...emptyOrderFilters, deliveryDate: "2026-11-01" },
      "Asia/Dhaka",
    ).length,
    1,
  );
  assert.deepEqual(
    filterAdminOrders(
      [legacy, regular],
      { ...emptyOrderFilters, sort: "delivery" },
      "Asia/Dhaka",
    ).map((item) => item.reference),
    ["SCHEDULED", "LEGACY"],
  );
  assert.equal(
    adminCalendarDate(new Date("2026-11-01T04:30:00Z"), "America/Los_Angeles"),
    "2026-10-31",
  );
  assert.equal(Reflect.has(legacy, "deliverySelection"), false);
});
