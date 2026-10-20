import test from "node:test";
import assert from "node:assert/strict";
import { products, filterProducts } from "../src/lib/catalog";
import { cartTotals, sanitizeCart } from "../src/lib/commerce";

test("reference basket totals are ৳460 plus ৳40 delivery", () => {
  const items = ["banana", "apple", "milk", "bread"].map((productId) => ({
    productId,
    quantity: 1,
  }));
  assert.deepEqual(cartTotals(items, products), {
    subtotal: 460,
    discount: 0,
    delivery: 40,
    total: 500,
    remaining: 540,
  });
});
test("free delivery starts at the exact threshold, and empty carts have no fee", () => {
  const catalog = [{ ...products[0], price: 1000 }];
  assert.equal(
    cartTotals([{ productId: "banana", quantity: 1 }], catalog).delivery,
    0,
  );
  assert.equal(cartTotals([], products).total, 0);
});
test("promo discount is capped and does not affect the free delivery threshold", () => {
  assert.equal(
    cartTotals([{ productId: "apple", quantity: 10 }], products, "fresh10")
      .discount,
    100,
  );
  const totals = cartTotals(
    [{ productId: "banana", quantity: 1 }],
    products,
    "FRESH10",
  );
  assert.equal(totals.total, 103);
  assert.equal(
    cartTotals([{ productId: "banana", quantity: 1 }], products, "INVALID")
      .discount,
    0,
  );
});
test("untrusted local storage is normalized, merged and capped to product stock", () => {
  assert.deepEqual(sanitizeCart(null, products), []);
  assert.deepEqual(
    sanitizeCart(
      [
        { productId: "banana", quantity: 29 },
        { productId: "banana", quantity: 9 },
        { productId: "apple", quantity: -8 },
        { productId: "missing", quantity: 1 },
        { productId: "milk", quantity: "10" },
        { productId: "bread", quantity: 2.8 },
      ],
      products,
    ),
    [
      { productId: "banana", quantity: 30 },
      { productId: "bread", quantity: 2 },
    ],
  );
});
test("search, filters and pagination compose without mutating the catalog", () => {
  const order = products.map((p) => p.id);
  const produce = filterProducts(products, {
    category: "produce",
    sort: "price-asc",
    limit: 4,
  });
  assert.equal(produce.total, 8);
  assert.equal(produce.products[0].id, "cucumber");
  assert.equal(produce.totalPages, 2);
  assert.equal(filterProducts(products, { q: "FUJI" }).products[0].id, "apple");
  assert.ok(
    filterProducts(products, { organic: true }).products.every(
      (p) => p.organic,
    ),
  );
  assert.ok(
    filterProducts(products, { offers: true }).products.every(
      (p) => p.originalPrice! > p.price,
    ),
  );
  assert.equal(
    filterProducts(products, { q: "nothing-like-this", page: 900 }).page,
    1,
  );
  assert.deepEqual(
    products.map((p) => p.id),
    order,
  );
});
