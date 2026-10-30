import { searchScore } from "./search";
import type { Translations } from "./content-language";
export type Product = {
  translations?: Translations;
  id: string;
  slug: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  originalPrice?: number;
  atlas: number;
  stock: number;
  lowStockThreshold?: number;
  searchTerms?: string[];
  description: string;
  organic?: boolean;
  rating: number;
  parentId?: string;
  brand?: string;
  dietary?: string[];
  measure?: number;
  measureUnit?: "kg" | "litre" | "piece";
  origin?: string;
  nutrition?: string;
  allergens?: string;
  storage?: string;
  imageUrl?: string;
  seasonal?: boolean;
  active?: boolean;
  createdAt?: string;
  version?: number;
};

export const products: Product[] = [
  {
    id: "banana",
    slug: "banana-local",
    name: "Banana (Local)",
    category: "fruits",
    unit: "1 kg (approx. 6–7 pcs)",
    price: 70,
    originalPrice: 100,
    atlas: 0,
    stock: 30,
    rating: 4.8,
    description:
      "Naturally sweet, locally grown bananas. A delicious breakfast companion and an easy, energy-filled snack for your everyday.",
  },
  {
    id: "apple",
    slug: "apple-fuji",
    name: "Apple (Fuji)",
    category: "fruits",
    unit: "1 kg (4–5 pcs)",
    price: 225,
    originalPrice: 300,
    atlas: 1,
    stock: 25,
    rating: 4.8,
    description:
      "Crisp, juicy and naturally sweet Fuji apples. A delicious choice for snacking, salads or desserts. Carefully selected for freshness and delivered straight to your door.",
  },
  {
    id: "tomato",
    slug: "tomato-local",
    name: "Tomato (Local)",
    category: "vegetables",
    unit: "500 g (approx. 5–7 pcs)",
    price: 40,
    atlas: 2,
    stock: 40,
    organic: true,
    rating: 4.7,
    description:
      "Sun-ripened tomatoes with bright colour and a beautifully fresh flavour. Perfect for salads, sauces and your favourite everyday recipes.",
  },
  {
    id: "carrot",
    slug: "carrot-local",
    name: "Carrot (Local)",
    category: "vegetables",
    unit: "500 g (approx. 4–6 pcs)",
    price: 50,
    atlas: 3,
    stock: 35,
    organic: true,
    rating: 4.6,
    description:
      "Fresh, crunchy carrots picked for their natural sweetness. Enjoy them raw, roasted or in a comforting homemade soup.",
  },
  {
    id: "broccoli",
    slug: "fresh-broccoli",
    name: "Fresh Broccoli",
    category: "vegetables",
    unit: "500 g (approx. 1 pc)",
    price: 80,
    originalPrice: 100,
    atlas: 4,
    stock: 18,
    organic: true,
    rating: 4.7,
    description:
      "A fresh crown of tender green broccoli. Steam, roast or stir-fry for an easy addition to a balanced meal.",
  },
  {
    id: "orange",
    slug: "orange-imported",
    name: "Orange (Imported)",
    category: "fruits",
    unit: "1 kg (4–6 pcs)",
    price: 160,
    atlas: 5,
    stock: 25,
    rating: 4.8,
    description:
      "Bright, juicy oranges with a refreshing citrus flavour. Wonderful for fresh juice or a naturally sweet afternoon snack.",
  },
  {
    id: "cucumber",
    slug: "cucumber-local",
    name: "Cucumber (Local)",
    category: "vegetables",
    unit: "500 g (3–5 pcs)",
    price: 35,
    atlas: 6,
    stock: 30,
    organic: true,
    rating: 4.5,
    description:
      "Cool, crisp cucumbers for fresh salads and quick snacks. Washed, selected and packed with care.",
  },
  {
    id: "potato",
    slug: "potato-local",
    name: "Potato (Local)",
    category: "vegetables",
    unit: "1 kg (6–8 pcs)",
    price: 45,
    atlas: 7,
    stock: 50,
    rating: 4.6,
    description:
      "Versatile golden potatoes for your kitchen staples. Delicious mashed, roasted or simmered in your favourite curry.",
  },
  {
    id: "milk",
    slug: "fresh-milk",
    name: "Fresh Milk",
    category: "dairy",
    unit: "1 litre",
    price: 80,
    originalPrice: 100,
    atlas: 8,
    stock: 20,
    rating: 4.9,
    description:
      "Fresh pasteurised milk for your morning coffee, breakfast cereal and home baking. Keep refrigerated and follow the date on the pack.",
  },
  {
    id: "bread",
    slug: "whole-wheat-bread",
    name: "Whole Wheat Bread",
    category: "bakery",
    unit: "400 g",
    price: 85,
    originalPrice: 100,
    atlas: 9,
    stock: 15,
    rating: 4.7,
    description:
      "A soft, hearty whole wheat loaf, sliced and ready for breakfast. A lovely choice for toast, sandwiches and sharing.",
  },
  {
    id: "eggs",
    slug: "farm-brown-eggs",
    name: "Farm Brown Eggs",
    category: "dairy",
    unit: "6 pcs",
    price: 90,
    atlas: 10,
    stock: 24,
    rating: 4.8,
    description:
      "Six carefully packed brown eggs for your everyday kitchen. Cook thoroughly and store in a cool place.",
  },
  {
    id: "oil",
    slug: "soyabean-oil",
    name: "Soyabean Oil",
    category: "pantry",
    unit: "1 litre",
    price: 175,
    atlas: 11,
    stock: 20,
    rating: 4.6,
    description:
      "A versatile cooking oil for everyday frying, sautéing and family meals. Store in a cool, dry place away from sunlight.",
  },
];

export const categories = [
  {
    slug: "produce",
    name: "Fresh Fruits & Vegetables",
    icon: "leaf",
    color: "#358830",
  },
  { slug: "dairy", name: "Dairy & Eggs", icon: "milk", color: "#0795dd" },
  { slug: "meat", name: "Meat & Seafood", icon: "beef", color: "#ed4549" },
  {
    slug: "bakery",
    name: "Bakery & Snacks",
    icon: "croissant",
    color: "#ed9624",
  },
  { slug: "pantry", name: "Pantry Staples", icon: "jar", color: "#df9419" },
  { slug: "beverages", name: "Beverages", icon: "cup", color: "#12a3d1" },
  { slug: "frozen", name: "Frozen Foods", icon: "snow", color: "#32a4e3" },
  { slug: "personal", name: "Personal Care", icon: "bottle", color: "#27a485" },
  {
    slug: "household",
    name: "Household Essentials",
    icon: "house",
    color: "#1877b3",
  },
  { slug: "baby", name: "Baby Care", icon: "baby", color: "#eea34d" },
  {
    slug: "health",
    name: "Health & Wellness",
    icon: "heart",
    color: "#f25a58",
  },
  { slug: "pets", name: "Pet Care", icon: "paw", color: "#e17730" },
];

// Sample SKUs: supplier-specific facts stay empty until entered by the store.
const measures: Record<string, [number, "kg" | "litre" | "piece"]> = {
  banana: [1, "kg"],
  apple: [1, "kg"],
  tomato: [0.5, "kg"],
  carrot: [0.5, "kg"],
  broccoli: [0.5, "kg"],
  orange: [1, "kg"],
  cucumber: [0.5, "kg"],
  potato: [1, "kg"],
  milk: [1, "litre"],
  bread: [0.4, "kg"],
  eggs: [6, "piece"],
  oil: [1, "litre"],
};
for (const p of products) {
  p.rating = 0;
  p.seasonal = ["orange", "apple", "broccoli"].includes(p.id);
  p.createdAt = "2026-10-01T00:00:00.000Z";
  p.brand = "Unspecified";
  const m = measures[p.id];
  if (m) {
    p.measure = m[0];
    p.measureUnit = m[1];
  }
}
for (const id of ["apple", "banana", "tomato", "carrot"]) {
  const base = products.find((p) => p.id === id)!;
  const factor = base.measure === 1 ? 0.5 : 2;
  products.push({
    ...base,
    id: `${id}-${factor === 0.5 ? "500g" : "1kg"}`,
    slug: `${base.slug}-${factor === 0.5 ? "500g" : "1kg"}`,
    parentId: base.id,
    unit: factor === 0.5 ? "500 g" : "1 kg",
    price: base.price * factor,
    originalPrice: base.originalPrice ? base.originalPrice * factor : undefined,
    measure: base.measure! * factor,
  });
}
export type CatalogFilters = {
  brand?: string;
  dietary?: string;
  pack?: string;
  includeVariants?: boolean;
  q?: string;
  category?: string;
  organic?: boolean;
  offers?: boolean;
  sort?: string;
  maxPrice?: number;
  page?: number;
  limit?: number;
};
export function filterProducts(
  catalog: Product[],
  filters: CatalogFilters = {},
) {
  const query = (filters.q || "").trim().toLowerCase();
  let result = catalog.filter(
    (p) =>
      p.active !== false &&
      (filters.includeVariants || !p.parentId || !!filters.pack) &&
      (!filters.brand || p.brand === filters.brand) &&
      (!filters.dietary || p.dietary?.includes(filters.dietary)) &&
      (!filters.pack || p.unit === filters.pack) &&
      (!query || searchScore(p, query) >= 0) &&
      (!filters.category ||
        filters.category === "all" ||
        (filters.category === "produce"
          ? ["fruits", "vegetables"].includes(p.category)
          : p.category === filters.category)) &&
      (!filters.organic || p.organic) &&
      (!filters.offers || (p.originalPrice || 0) > p.price) &&
      (filters.maxPrice === undefined || p.price <= filters.maxPrice),
  );
  if (query && (!filters.sort || filters.sort === "featured"))
    result.sort((a, b) => searchScore(b, query) - searchScore(a, query));
  if (filters.sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (filters.sort === "price-desc") result.sort((a, b) => b.price - a.price);
  if (filters.sort === "rating") result.sort((a, b) => b.rating - a.rating);
  if (filters.sort === "name")
    result.sort((a, b) => a.name.localeCompare(b.name));
  const total = result.length;
  const limit = Math.max(1, Math.min(48, filters.limit || 8));
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.max(1, Math.min(totalPages, filters.page || 1));
  result = result.slice((page - 1) * limit, page * limit);
  return { products: result, total, page, totalPages };
}
