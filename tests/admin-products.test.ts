import test from "node:test";
import assert from "node:assert/strict";
import { products, type Product } from "../src/lib/catalog";
import {
  createProductDraft,
  productDraftPayload,
  validateProductDraft,
  filterAdminProducts,
  emptyProductFilters,
  productKey,
} from "../src/lib/admin-products";

test("product editor preserves version, zero threshold and untranslated source snapshots", () => {
  const original: Product = {
    ...products[0],
    version: 7,
    lowStockThreshold: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    translations: { bn: { name: { text: "কলা", source: products[0].name } } },
  };
  const draft = createProductDraft(original);
  draft.name = "Changed English name";
  draft.originalPrice = "";
  draft.measure = "";
  draft.changeReason = "  Shelf count corrected  ";
  const payload = productDraftPayload(draft, original);
  assert.equal(payload.lowStockThreshold, 0);
  assert.equal(payload.version, 7);
  assert.equal(payload.createdAt, original.createdAt);
  assert.equal(payload.originalPrice, undefined);
  assert.equal(payload.measureUnit, undefined);
  assert.equal(payload.changeReason, "Shelf count corrected");
  assert.equal(payload.translations?.bn?.name.source, original.name);
  draft.translations.bn!.name.text = "Changed draft";
  assert.equal(original.translations?.bn?.name.text, "কলা");
  assert.equal(payload.translations?.bn?.name.text, "কলা");
});

test("product validation prevents duplicate identities, unsafe prices and fractional packs before saving", () => {
  const draft = createProductDraft(products[0]);
  assert.deepEqual(validateProductDraft(draft, products[0], products), {});
  draft.id = products[1].id;
  draft.slug = products[1].slug;
  draft.price = "10.001";
  draft.originalPrice = "9";
  draft.stock = "1.5";
  draft.measure = "0";
  draft.parentId = draft.id;
  const errors = validateProductDraft(draft, null, products);
  for (const key of [
    "id",
    "slug",
    "price",
    "originalPrice",
    "stock",
    "measure",
    "parentId",
  ])
    assert.ok(errors[key as keyof typeof errors], key);
  draft.price = "0.29";
  draft.originalPrice = "";
  draft.stock = "0";
  draft.measure = "0.001";
  draft.lowStockThreshold = "0";
  const validNumbers = validateProductDraft(draft, null, products);
  for (const key of ["price", "stock", "measure", "lowStockThreshold"])
    assert.equal(validNumbers[key as keyof typeof validNumbers], undefined);
  assert.equal(productKey("Crème Tomato / 500 g"), "creme-tomato-500-g");
});

test("product filters combine bilingual search, visibility and per-SKU low stock without changing catalog order", () => {
  const catalog: Product[] = [
    { ...products[0], stock: 0, lowStockThreshold: 0, searchTerms: ["কলা"] },
    { ...products[1], stock: 1, active: false },
    { ...products[2], stock: 3, lowStockThreshold: 0 },
  ];
  const before = catalog.map((p) => p.id);
  assert.deepEqual(
    filterAdminProducts(
      catalog,
      { ...emptyProductFilters, query: "কলা", stock: "low" },
      5,
    ).map((p) => p.id),
    [catalog[0].id],
  );
  assert.deepEqual(
    filterAdminProducts(
      catalog,
      { ...emptyProductFilters, visibility: "hidden" },
      5,
    ).map((p) => p.id),
    [catalog[1].id],
  );
  assert.deepEqual(
    filterAdminProducts(
      catalog,
      { ...emptyProductFilters, stock: "low" },
      5,
    ).map((p) => p.id),
    [catalog[0].id],
  );
  filterAdminProducts(
    catalog,
    { ...emptyProductFilters, sort: "price-desc" },
    5,
  );
  assert.deepEqual(
    catalog.map((p) => p.id),
    before,
  );
});
