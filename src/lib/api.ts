import { products, type Product } from "./catalog";
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
  } catch {
    // The bundled catalog also lets the web app build and preview independently.
    return products;
  }
}
