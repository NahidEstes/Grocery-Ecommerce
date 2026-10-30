import { demoContent, demoProducts, demoRecipes, demoSettings } from "./data";

// Explicit allowlist: no demo action can fall through to the real API.
export async function demoApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  if (method === "GET") {
    if (path === "/catalog") return { products: demoProducts } as T;
    if (path === "/storefront")
      return {
        mode: "demo",
        content: demoContent,
        recipes: demoRecipes,
        settings: demoSettings,
        payments: { enabled: false, sandbox: true },
        popularIds: ["apple", "banana", "milk", "bread"],
        reviews: [],
      } as T;
    if (path === "/auth/session") return { user: null } as T;
  }
  throw Object.assign(
    new Error(
      "Disabled in browser demo. No account, payment, email or backend request was sent.",
    ),
    { status: 403 },
  );
}
