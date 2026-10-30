import type { Locale } from "./i18n";
import type { Product } from "./catalog";
import type { Recipe } from "./recipes";
import type { ContentConfig } from "./management";

export type Translations = {
  bn?: Record<string, { source: string; text: string }>;
};
export type Translatable = { translations?: Translations };
export type ContentKind = "product" | "homepage" | "recipe";
export type LanguageField = {
  path: string;
  label: string;
  max: number;
  multiline?: boolean;
};

export function readText(entity: object, path: string): string {
  let value: unknown = entity;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, part))
      return "";
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : "";
}
export function withText<T extends object>(
  entity: T,
  path: string,
  text: string,
): T {
  const next = structuredClone(entity);
  const parts = path.split(".");
  let target = next as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(part) ||
      !Object.hasOwn(target, part) ||
      typeof target[part] !== "object" ||
      !target[part]
    )
      throw new Error("Invalid content field");
    target = target[part] as Record<string, unknown>;
  }
  const key = parts.at(-1)!;
  if (["__proto__", "constructor", "prototype"].includes(key))
    throw new Error("Invalid content field");
  target[key] = text;
  return next;
}
export function translatedText<T extends Translatable & object>(
  entity: T,
  path: string,
  locale: Locale,
): string {
  const source = readText(entity, path);
  const entry = entity.translations?.bn?.[path];
  // English edits/reordered fields cannot silently publish an old translation.
  return locale === "bn" && entry?.source === source && entry.text.trim()
    ? entry.text
    : source;
}
export function languageFields(
  kind: ContentKind,
  entity: object,
): LanguageField[] {
  const field = (
    path: string,
    label: string,
    max = 2000,
    multiline = false,
  ) => ({ path, label, max, multiline });
  if (kind === "product")
    return [
      field("name", "Product name", 120),
      field("unit", "Pack label", 60),
      field("description", "Description", 2000, true),
      field("brand", "Brand", 80),
      field("origin", "Origin", 150),
      field("nutrition", "Nutrition", 1500, true),
      field("allergens", "Allergens", 1000, true),
      field("storage", "Storage & care", 1000, true),
    ];
  if (kind === "recipe") {
    const recipe = entity as Recipe;
    return [
      field("title", "Recipe title", 100),
      field("eyebrow", "Small heading", 70),
      field("description", "Description", 400, true),
      field("allergenNote", "Allergen note", 1000, true),
      ...recipe.ingredients.flatMap((_, i) => [
        field(`ingredients.${i}.name`, `Ingredient ${i + 1}`, 100),
        ...(!recipe.ingredients[i].productId
          ? [field(`ingredients.${i}.pantry`, `Pantry note ${i + 1}`, 200)]
          : []),
      ]),
      ...recipe.steps.map((_, i) =>
        field(`steps.${i}`, `Step ${i + 1}`, 1000, true),
      ),
    ];
  }
  const content = entity as ContentConfig;
  return [
    ...["hero", ...content.banners.map((_, i) => `banners.${i}`)].flatMap(
      (prefix) => [
        field(`${prefix}.eyebrow`, `${prefix}: small heading`, 70),
        field(`${prefix}.title`, `${prefix}: title`, 100),
        field(`${prefix}.description`, `${prefix}: description`, 250, true),
        field(`${prefix}.button`, `${prefix}: button`, 50),
      ],
    ),
    field("hero.highlight", "Hero highlighted text", 80),
    field("dealsTitle", "Deals heading", 100),
    ...content.sections.map((s, i) =>
      field(`sections.${i}.title`, `${s.id}: heading`, 100),
    ),
  ];
}
export function localizeEntity<T extends Translatable & object>(
  kind: ContentKind,
  entity: T,
  locale: Locale,
): T {
  if (locale === "en" || !entity.translations?.bn) return entity;
  let next = entity;
  for (const { path } of languageFields(kind, entity)) {
    const text = translatedText(entity, path, locale);
    if (text !== readText(entity, path)) next = withText(next, path, text);
  }
  return next;
}
export const localizeProduct = (product: Product, locale: Locale) => ({
  ...localizeEntity("product", product, locale),
  searchTerms: [
    ...(product.searchTerms || []),
    product.name,
    product.unit,
    ...Object.values(product.translations?.bn || {}).map((v) => v.text),
  ],
});

export function confirmTranslations<T extends Translatable & object>(
  kind: ContentKind,
  entity: T,
): T {
  const entries = languageFields(kind, entity).flatMap(({ path }) => {
    const text = entity.translations?.bn?.[path]?.text.trim();
    return text ? [[path, { source: readText(entity, path), text }]] : [];
  });
  return { ...entity, translations: { bn: Object.fromEntries(entries) } };
}
