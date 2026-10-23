import assert from "node:assert/strict";
import test from "node:test";
import bangla from "../src/lib/locales/bn.json";
import { normalizeLocale, translate, localeTag } from "../src/lib/i18n";
import { defaultContent } from "../src/lib/management";
import { defaultSettings, unitPrice } from "../src/lib/storefront";
import { products } from "../src/lib/catalog";
import { recipes } from "../src/lib/recipes";
import { formatDelivery, orderTime } from "../src/lib/orders";

test("language preferences accept supported locales and default safely", () => {
  assert.equal(normalizeLocale("bn"), "bn");
  for (const value of [
    undefined,
    null,
    "en",
    "fr",
    "BN",
    "bn-BD",
    "<script>",
    {},
  ])
    assert.equal(normalizeLocale(value), "en");
  assert.equal(localeTag("bn"), "bn-BD");
});

test("translation falls back without changing custom content or whitespace", () => {
  assert.equal(translate("en", "Checkout"), "Checkout");
  assert.equal(translate("bn", " Checkout "), " চেকআউট ");
  assert.equal(
    translate("bn", "Merchant's new product"),
    "Merchant's new product",
  );
  assert.equal(translate("bn", "আমার নিজস্ব তালিকা"), "আমার নিজস্ব তালিকা");
  assert.equal(translate("bn", "toString"), "toString");
  assert.equal(translate("bn", ""), "");
});

test("interpolation preserves user text literally, without recursive substitution", () => {
  assert.equal(
    translate("bn", "Open basket, {count} items", { count: 3 }),
    "কার্ট খুলুন, 3টি পণ্য",
  );
  assert.equal(
    translate("en", "View {name}", { name: "$& {other}" }),
    "View $& {other}",
  );
  assert.equal(translate("en", "View {name}"), "View {name}");
  for (const [key, value] of Object.entries(bangla)) {
    assert.ok(value.trim(), `Empty translation: ${key}`);
    assert.deepEqual(
      [...key.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
      [...value.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
      `Mismatched placeholders: ${key}`,
    );
  }
});

test("bundled homepage, catalog, categories and FAQs have Bangla copy", () => {
  const copy = [
    ...[defaultContent.hero, ...defaultContent.banners].flatMap(
      ({ eyebrow, title, description, button }) => [
        eyebrow,
        title,
        description,
        button,
      ],
    ),
    defaultContent.hero.highlight,
    defaultContent.dealsTitle,
    ...defaultContent.sections.map((s) => s.title),
    ...defaultSettings.categories.map((c) => c.name),
    ...defaultSettings.bundles.flatMap((b) => [b.name, b.description]),
    ...defaultSettings.faqs.flatMap((f) => [f.question, f.answer]),
    ...products.flatMap((p) => [p.name, p.unit]),
    ...recipes.flatMap((r) => [
      r.title,
      r.eyebrow,
      r.description,
      r.allergenNote,
      ...r.steps,
      ...r.ingredients.map((i) => i.name),
    ]),
  ];
  for (const source of copy)
    assert.notEqual(
      translate("bn", source),
      source,
      `Missing translation: ${source}`,
    );
});

test("display dates and unit labels localize while preserving delivery identity and pricing", () => {
  const selection = { date: "2026-10-24", slot: "afternoon" as const };
  const before = structuredClone(selection);
  assert.match(formatDelivery(selection, "bn"), /দুপুর/);
  assert.match(formatDelivery(selection), /12 PM/);
  assert.deepEqual(selection, before);
  assert.match(orderTime("2026-10-24T08:00:00Z", "bn"), /অক্টো/);
  const product = { ...products[0], measure: 1, measureUnit: "kg" as const };
  assert.equal(unitPrice(product, "bn"), "৳ 70 / কেজি");
  assert.equal(unitPrice(product), "৳ 70 / kg");
});
