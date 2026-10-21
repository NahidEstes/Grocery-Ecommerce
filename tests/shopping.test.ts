import test from "node:test";
import assert from "node:assert/strict";
import { products, filterProducts } from "../src/lib/catalog";
import { normalizeSearch, searchProducts } from "../src/lib/search";
import { planBasket, regularPurchases, activeOrder } from "../src/lib/shopping";
import { ingredientPacks, ingredientAmount, recipes } from "../src/lib/recipes";
import type { OrderRecord } from "../src/lib/orders";

test("Bengali, English and transliteration searches resolve the same groceries", () => {
  for (const query of ["আলু", "potato", "ALOO", "alu"])
    assert.equal(searchProducts(products, query)[0].id, "potato");
  for (const query of ["দুধ", "milk", "dudh", "দু"])
    assert.equal(searchProducts(products, query)[0].id, "milk");
  for (const query of ["ডিম", "egg", "eggs", "dim"])
    assert.equal(searchProducts(products, query)[0].id, "eggs");
  assert.equal(
    filterProducts(products, { q: "১ কেজি আলু" }).products[0].id,
    "potato",
  );
  assert.equal(
    filterProducts(products, { q: "দুধ ১ লিটার" }).products[0].id,
    "milk",
  );
  assert.equal(searchProducts(products, "সয়াবিন তেল")[0].id, "oil");
  assert.equal(searchProducts(products, "শসা")[0].id, "cucumber");
  assert.equal(searchProducts(products, "পাউরুটি")[0].id, "bread");
  assert.deepEqual(searchProducts(products, "a made up grocery"), []);
  assert.deepEqual(searchProducts(products, " "), []);
  assert.equal(normalizeSearch("  ALU  ৫০০\u200b G "), "alu 500 g");
  assert.ok(searchProducts(products, "apple").every((p) => !p.parentId));
  assert.equal(
    searchProducts(
      products.map((p) => ({ ...p, active: false })),
      "আলু",
    ).length,
    0,
  );
});
test("multi-word smart search composes with category, pack and price filters", () => {
  assert.equal(
    filterProducts(products, { q: "দুধ", category: "fruits" }).total,
    0,
  );
  assert.equal(
    filterProducts(products, { q: "আপেল", pack: "500 g", maxPrice: 120 })
      .products[0].id,
    "apple-500g",
  );
  assert.equal(filterProducts(products, { q: "দুধ", maxPrice: 50 }).total, 0);
});
function order(
  reference: string,
  userId: string,
  createdAt: string,
  changes: Partial<OrderRecord> = {},
): OrderRecord {
  return {
    reference,
    userId,
    createdAt,
    status: "delivered",
    payment: "cash-on-delivery",
    items: [
      {
        productId: "milk",
        quantity: 1,
        name: "Milk snapshot",
        unit: "1 litre",
        atlas: 8,
        price: 80,
      },
    ],
    customer: {
      name: "Private name",
      phone: "01712345678",
      address: "Private full address",
      area: "Dhanmondi",
    },
    subtotal: 80,
    delivery: 40,
    discount: 0,
    total: 120,
    mode: "demo",
    instructions: "Private note",
    deliverySelection: { date: "2026-10-22", slot: "afternoon" },
    accessTokenHash: "private-secret",
    fingerprint: "private-fingerprint",
    ...changes,
  };
}
test("regular purchases belong to the owner and use latest quantities ranked by order frequency", () => {
  const orders = [
    order("FC-111111111111", "alice", "2026-10-19T10:00:00Z"),
    order("FC-222222222222", "alice", "2026-10-20T10:00:00Z", {
      items: [
        {
          productId: "milk",
          quantity: 3,
          name: "Fresh Milk",
          unit: "1 litre",
          atlas: 8,
          price: 80,
        },
      ],
    }),
    order("FC-333333333333", "bob", "2026-10-21T10:00:00Z"),
    order("FC-444444444444", "alice", "2026-10-21T10:00:00Z", {
      status: "cancelled",
    }),
    order("FC-555555555555", "alice", "2026-10-21T11:00:00Z", {
      payment: "online",
      paymentStatus: "pending",
    }),
  ];
  const regular = regularPurchases(orders, "alice");
  assert.equal(regular.length, 1);
  assert.equal(regular[0].purchaseCount, 2);
  assert.equal(regular[0].quantity, 3);
  assert.equal(regular[0].name, "Fresh Milk");
  assert.equal(regular[0].lastOrderedAt, "2026-10-20T10:00:00Z");
  assert.equal(regularPurchases(orders, "unknown").length, 0);
  assert.equal(
    (regular[0] as unknown as Record<string, unknown>).price,
    undefined,
  );
});
test("active order summaries select the newest unfinished owner order and exclude private details", () => {
  const orders = [
    order("FC-111111111111", "alice", "2026-10-19T10:00:00Z", {
      status: "preparing",
    }),
    order("FC-222222222222", "alice", "2026-10-20T10:00:00Z"),
    order("FC-333333333333", "bob", "2026-10-21T11:00:00Z", {
      status: "out-for-delivery",
    }),
    order("FC-444444444444", "alice", "2026-10-21T10:00:00Z", {
      status: "placed",
      payment: "online",
      paymentStatus: "pending",
    }),
  ];
  const active = activeOrder(orders, "alice");
  assert.equal(active?.reference, "FC-444444444444");
  assert.equal(active?.paymentStatus, "pending");
  assert.equal(
    (active as unknown as Record<string, unknown>).customer,
    undefined,
  );
  assert.equal(
    (active as unknown as Record<string, unknown>).accessTokenHash,
    undefined,
  );
  assert.equal(activeOrder(orders, "nobody"), null);
});
test("basket planning merges quantities, accounts for existing packs and reports unavailable items", () => {
  const catalog = products.map((p) =>
    p.id === "milk" ? { ...p, price: 90, stock: 4 } : p,
  );
  const plan = planBasket(
    [
      { productId: "milk", quantity: 2 },
      { productId: "milk", quantity: 2 },
      { productId: "missing", quantity: 1 },
      { productId: "apple", quantity: -2 },
    ],
    catalog,
    [{ productId: "milk", quantity: 3 }],
  );
  assert.deepEqual(plan.additions, [{ productId: "milk", quantity: 1 }]);
  assert.equal(plan.subtotal, 90);
  assert.equal(plan.issues.length, 2);
  assert.equal(plan.issues[0].reason, "limited");
  assert.equal(plan.issues[0].requested, 4);
  assert.equal(plan.issues[0].available, 1);
  assert.equal(
    planBasket(
      [{ productId: "milk", quantity: 1 }],
      catalog.map((p) => ({ ...p, active: false })),
    ).additions.length,
    0,
  );
  assert.equal(
    planBasket([{ productId: "milk", quantity: 100 }], catalog).additions[0]
      .quantity,
    4,
  );
});
test("recipe servings convert ingredient amounts into whole sale packs without buying pantry items", () => {
  const salad = recipes[0],
    tomato = salad.ingredients.find((i) => i.id === "tomato")!;
  assert.equal(
    ingredientPacks(
      tomato,
      products.find((p) => p.id === "tomato"),
      2,
      2,
    ),
    1,
  );
  assert.equal(
    ingredientPacks(
      tomato,
      products.find((p) => p.id === "tomato"),
      8,
      2,
    ),
    2,
  );
  assert.equal(
    ingredientPacks(
      tomato,
      products.find((p) => p.id === "tomato-1kg"),
      8,
      2,
    ),
    1,
  );
  assert.equal(ingredientAmount(tomato, 4, 2), "500 g");
  assert.equal(ingredientPacks(tomato, undefined, 2, 2), null);
  assert.equal(
    ingredientPacks(
      tomato,
      products.find((p) => p.id === "milk"),
      2,
      2,
    ),
    null,
  );
  assert.equal(ingredientPacks(salad.ingredients[3], products[0], 2, 2), null);
  const bread = recipes[1].ingredients.find((i) => i.id === "bread")!;
  assert.equal(
    ingredientPacks(
      bread,
      products.find((p) => p.id === "bread"),
      8,
      2,
    ),
    2,
  );
});
