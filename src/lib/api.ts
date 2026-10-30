import { type Product } from "./catalog";
import { type Recipe } from "./recipes";
import { defaultContent, type ContentConfig } from "./management";
import { type StoreSettings } from "./storefront";
import { BROWSER_DEMO } from "./browser-demo/config";
import { unstable_rethrow } from "next/navigation";
export async function loadStorefront(): Promise<{
  content: ContentConfig;
  recipes: Recipe[];
  settings: StoreSettings;
  mode: "demo" | "production";
}> {
  if (BROWSER_DEMO) {
    const { demoApi } = await import("./browser-demo/adapter");
    return demoApi("/storefront");
  }
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
    unstable_rethrow(error);
    throw new Error("Store service unavailable. Please try again shortly.", {
      cause: error,
    });
  }
}
export async function loadRecipes(): Promise<Recipe[]> {
  if (BROWSER_DEMO) return (await import("./browser-demo/data")).demoRecipes;
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
    unstable_rethrow(error);
    throw new Error("Store service unavailable. Please try again shortly.", {
      cause: error,
    });
  }
}
export async function loadCatalog(): Promise<Product[]> {
  if (BROWSER_DEMO) return (await import("./browser-demo/data")).demoProducts;
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
    unstable_rethrow(error);
    throw new Error("Store catalog unavailable. Please try again shortly.", {
      cause: error,
    });
  }
}
