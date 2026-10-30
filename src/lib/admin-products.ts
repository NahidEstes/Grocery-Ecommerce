import type { Product } from "./catalog";
import { searchScore } from "./search";
import type { Translations } from "./content-language";

export const productSections = [
  {
    id: "basics",
    label: "Basics",
    description: "Name, category and the details customers see first.",
  },
  {
    id: "pricing",
    label: "Pricing",
    description: "Set the price for this pack, in your store currency.",
  },
  {
    id: "stock",
    label: "Stock & variants",
    description: "Manage packs, stock alerts and product families.",
  },
  {
    id: "photos",
    label: "Photos & details",
    description: "Add a photo and optional supplier information.",
  },
  {
    id: "language",
    label: "বাংলা content",
    description: "Optional Bangla copy, with the same price and stock.",
  },
] as const;
export type ProductSection = (typeof productSections)[number]["id"];
export type ProductDraft = Record<
  | "id"
  | "slug"
  | "name"
  | "category"
  | "unit"
  | "brand"
  | "price"
  | "originalPrice"
  | "stock"
  | "measure"
  | "measureUnit"
  | "lowStockThreshold"
  | "parentId"
  | "searchTerms"
  | "dietary"
  | "origin"
  | "nutrition"
  | "allergens"
  | "storage"
  | "imageUrl"
  | "description"
  | "changeReason",
  string
> & {
  atlas: number;
  active: boolean;
  organic: boolean;
  seasonal: boolean;
  translations: Translations;
};
export type ProductSave = Product & { changeReason?: string };
export type ProductErrors = Partial<Record<keyof ProductDraft, string>>;
export function productKey(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}
export function createProductDraft(
  product: Product | null,
  category = "",
): ProductDraft {
  const number = (value?: number) => (value === undefined ? "" : String(value));
  return {
    id: product?.id || "",
    slug: product?.slug || "",
    name: product?.name || "",
    category: product?.category || category,
    unit: product?.unit || "",
    brand: product?.brand || "",
    price: number(product?.price),
    originalPrice: number(product?.originalPrice),
    stock: number(product?.stock ?? 0),
    measure: number(product?.measure),
    measureUnit: product?.measureUnit || "kg",
    lowStockThreshold: number(product?.lowStockThreshold),
    parentId: product?.parentId || "",
    searchTerms: product?.searchTerms?.join(", ") || "",
    dietary: product?.dietary?.join(", ") || "",
    origin: product?.origin || "",
    nutrition: product?.nutrition || "",
    allergens: product?.allergens || "",
    storage: product?.storage || "",
    imageUrl: product?.imageUrl || "",
    description: product?.description || "",
    changeReason: "",
    atlas: product?.atlas ?? 0,
    active: product?.active !== false,
    organic: !!product?.organic,
    seasonal: !!product?.seasonal,
    translations: structuredClone(product?.translations || {}),
  };
}
const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isProductImageUrl = (value: string) =>
  !value ||
  /^\/api\/media\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(value) ||
  (() => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  })();
export const commaValues = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
export function validateProductDraft(
  draft: ProductDraft,
  original: Product | null,
  catalog: Product[],
): ProductErrors {
  const errors: ProductErrors = {};
  for (const key of ["id", "slug", "category"] as const)
    if (!keyPattern.test(draft[key]) || draft[key].length > 60)
      errors[key] =
        "Use up to 60 lowercase English letters, numbers and single hyphens.";
  if (!original && catalog.some((product) => product.id === draft.id))
    errors.id =
      "This SKU already exists. Choose a unique ID or edit the existing product.";
  if (original && draft.id !== original.id)
    errors.id = "An existing product ID cannot be changed.";
  if (
    catalog.some(
      (product) => product.slug === draft.slug && product.id !== original?.id,
    )
  )
    errors.slug =
      "This product URL is already used. Choose a different URL slug.";
  if (draft.name.trim().length < 2 || draft.name.trim().length > 120)
    errors.name = "Enter a product name between 2 and 120 characters.";
  if (!draft.unit.trim() || draft.unit.trim().length > 60)
    errors.unit =
      "Enter a pack label, for example 500 g or 6 pieces (up to 60 characters).";
  function numeric(
    key: "price" | "originalPrice" | "stock" | "measure" | "lowStockThreshold",
    min: number,
    max: number,
    required: boolean,
    integer = false,
  ) {
    const raw = draft[key].trim(),
      value = Number(raw);
    if (!raw && !required) return;
    if (
      !raw ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      errors[key] = integer
        ? `Enter a whole number from ${min} to ${max}.`
        : `Enter a number from ${min} to ${max}.`;
    else if (
      (key === "price" || key === "originalPrice") &&
      Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
    )
      errors[key] = "Use no more than two decimal places.";
  }
  numeric("price", 0.01, 500000, true);
  numeric("originalPrice", 0.01, 500000, false);
  numeric("stock", 0, 100000, true, true);
  numeric("lowStockThreshold", 0, 100000, false, true);
  numeric("measure", 0, 10000, false);
  if (draft.measure.trim() && Number(draft.measure) <= 0)
    errors.measure = "Enter a pack amount greater than zero, up to 10000.";
  if (draft.measure && !["kg", "litre", "piece"].includes(draft.measureUnit))
    errors.measureUnit = "Choose a comparison unit.";
  if (
    !errors.originalPrice &&
    draft.originalPrice &&
    Number(draft.originalPrice) < Number(draft.price)
  )
    errors.originalPrice =
      "The original price must be at least the selling price.";
  if (
    draft.parentId &&
    (draft.parentId === draft.id ||
      !catalog.some(
        (product) => product.id === draft.parentId && !product.parentId,
      ))
  )
    errors.parentId = "Choose an existing base product other than this SKU.";
  for (const [key, max] of [
    ["brand", 80],
    ["description", 2000],
    ["origin", 150],
    ["nutrition", 1500],
    ["allergens", 1000],
    ["storage", 1000],
  ] as const)
    if (draft[key].trim().length > max)
      errors[key] = `Use ${max} characters or fewer.`;
  if (
    draft.changeReason &&
    (draft.changeReason.trim().length < 3 ||
      draft.changeReason.trim().length > 200)
  )
    errors.changeReason = "Use 3–200 characters to describe the stock change.";
  if (!isProductImageUrl(draft.imageUrl.trim()))
    errors.imageUrl =
      "Use an HTTPS image URL or upload a PNG, JPEG or WebP photo.";
  if (
    commaValues(draft.dietary).length > 8 ||
    commaValues(draft.dietary).some((item) => item.length > 40)
  )
    errors.dietary = "Use up to 8 tags, with 40 characters or fewer per tag.";
  if (
    commaValues(draft.searchTerms).length > 30 ||
    commaValues(draft.searchTerms).some((item) => item.length > 80)
  )
    errors.searchTerms =
      "Use up to 30 search alternatives, with 80 characters or fewer each.";
  if (!Number.isInteger(draft.atlas) || draft.atlas < 0 || draft.atlas > 11)
    errors.atlas = "Choose one of the bundled photos.";
  const translatedLimits: Record<string, number> = {
    name: 120,
    unit: 60,
    description: 2000,
    brand: 80,
    origin: 150,
    nutrition: 1500,
    allergens: 1000,
    storage: 1000,
  };
  if (
    Object.entries(draft.translations.bn || {}).some(
      ([path, entry]) =>
        !translatedLimits[path] || entry.text.length > translatedLimits[path],
    )
  )
    errors.translations =
      "One or more Bangla fields exceed their character limit.";
  return errors;
}
export function productDraftPayload(
  draft: ProductDraft,
  original: Product | null,
): ProductSave {
  return {
    ...(original || {}),
    id: draft.id.trim(),
    slug: draft.slug.trim(),
    name: draft.name.trim(),
    category: draft.category,
    unit: draft.unit.trim(),
    price: Number(draft.price),
    originalPrice: draft.originalPrice.trim()
      ? Number(draft.originalPrice)
      : undefined,
    stock: Number(draft.stock),
    atlas: draft.atlas,
    rating: original?.rating || 0,
    version: original?.version || 0,
    parentId: draft.parentId || undefined,
    measure: draft.measure.trim() ? Number(draft.measure) : undefined,
    measureUnit: draft.measure.trim()
      ? (draft.measureUnit as Product["measureUnit"])
      : undefined,
    lowStockThreshold: draft.lowStockThreshold.trim()
      ? Number(draft.lowStockThreshold)
      : undefined,
    brand: draft.brand.trim(),
    dietary: commaValues(draft.dietary),
    searchTerms: commaValues(draft.searchTerms),
    description: draft.description.trim(),
    origin: draft.origin.trim(),
    nutrition: draft.nutrition.trim(),
    allergens: draft.allergens.trim(),
    storage: draft.storage.trim(),
    imageUrl: draft.imageUrl.trim(),
    active: draft.active,
    organic: draft.organic,
    seasonal: draft.seasonal,
    translations: structuredClone(draft.translations),
    changeReason: draft.changeReason.trim() || undefined,
  };
}
export function productFieldSection(field: string): ProductSection {
  if (["price", "originalPrice", "measure", "measureUnit"].includes(field))
    return "pricing";
  if (
    ["stock", "parentId", "lowStockThreshold", "changeReason"].includes(field)
  )
    return "stock";
  if (
    [
      "imageUrl",
      "atlas",
      "origin",
      "nutrition",
      "allergens",
      "storage",
      "dietary",
      "organic",
      "seasonal",
    ].includes(field)
  )
    return "photos";
  if (field === "translations") return "language";
  return "basics";
}
export type ProductFilters = {
  query: string;
  category: string;
  visibility: string;
  stock: string;
  sort: string;
};
export const emptyProductFilters: ProductFilters = {
  query: "",
  category: "",
  visibility: "",
  stock: "",
  sort: "name",
};
export const isLowStock = (product: Product, threshold: number) =>
  product.active !== false &&
  product.stock <= (product.lowStockThreshold ?? threshold);
export function filterAdminProducts(
  catalog: Product[],
  filters: ProductFilters,
  threshold: number,
) {
  const query = filters.query.trim().toLowerCase();
  return catalog
    .filter(
      (product) =>
        (!query ||
          `${product.id} ${product.name} ${product.unit} ${product.brand || ""}`
            .toLowerCase()
            .includes(query) ||
          searchScore(product, query) >= 0) &&
        (!filters.category || product.category === filters.category) &&
        (!filters.visibility ||
          (filters.visibility === "hidden"
            ? product.active === false
            : product.active !== false)) &&
        (!filters.stock ||
          (filters.stock === "low"
            ? isLowStock(product, threshold)
            : product.active !== false && product.stock === 0)),
    )
    .sort((a, b) =>
      filters.sort === "price-asc"
        ? a.price - b.price
        : filters.sort === "price-desc"
          ? b.price - a.price
          : filters.sort === "stock"
            ? a.stock - b.stock
            : filters.sort === "newest"
              ? (b.createdAt || "").localeCompare(a.createdAt || "")
              : a.name.localeCompare(b.name),
    );
}
