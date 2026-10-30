import { products, type Product } from "./catalog";
import { type Recipe } from "./recipes";
import { defaultContent, type ContentConfig } from "./management";
import { defaultSettings, type StoreSettings } from "./storefront";
export async function loadStorefront(): Promise<{
  content: ContentConfig;
  recipes: Recipe[];
  settings: StoreSettings;
  mode: "demo" | "production";
}> {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4100"}/api/storefront`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (
      !response.ok ||
      response.headers.get("X-FreshCart-Service") !== "freshcart-api"
    )
      throw new Error("Unavailable");
    const data = await response.json();
    if (process.env.STORE_MODE === "production" && data.mode !== "production")
      throw new Error(
        "Store mode mismatch: production web requires a production API.",
      );
    return {
      settings: data.settings,
      mode: data.mode === "production" ? "production" : "demo",
      content: data.content || defaultContent,
      recipes: Array.isArray(data.recipes) ? data.recipes : [],
    };
  } catch (error) {
    if (
      process.env.STORE_MODE === "production" ||
      (process.env.NODE_ENV === "production" && !process.env.STORE_MODE)
    )
      throw new Error("Store service unavailable. Please try again shortly.", {
        cause: error,
      });
    return {
      content: defaultContent,
      recipes: [],
      settings: defaultSettings,
      mode: "demo",
    };
  }
}
export async function loadRecipes(): Promise<Recipe[]> {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4100"}/api/recipes`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (
      !response.ok ||
      response.headers.get("X-FreshCart-Service") !== "freshcart-api"
    )
      throw new Error("Unavailable");
    const data = await response.json();
    return data.recipes;
  } catch (error) {
    if (
      process.env.STORE_MODE === "production" ||
      (process.env.NODE_ENV === "production" && !process.env.STORE_MODE)
    )
      throw new Error("Store service unavailable. Please try again shortly.", {
        cause: error,
      });
    return [];
  }
}
export async function loadCatalog(): Promise<Product[]> {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4100"}/api/catalog`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (
      !response.ok ||
      response.headers.get("X-FreshCart-Service") !== "freshcart-api"
    )
      throw new Error("FreshCart catalog unavailable");
    const data = await response.json();
    if (
      !Array.isArray(data.products) ||
      !data.products.every(
        (p: Product) =>
          typeof p.name === "string" &&
          Number.isFinite(p.atlas) &&
          Number.isFinite(p.price),
      )
    )
      throw new Error("Invalid catalog response");
    return data.products;
  } catch (error) {
    if (
      process.env.STORE_MODE === "production" ||
      (process.env.NODE_ENV === "production" && !process.env.STORE_MODE)
    )
      throw new Error("Store catalog unavailable. Please try again shortly.", {
        cause: error,
      });
    // The bundled catalog also lets the web app build and preview independently.
    return products;
  }
}
