import type { MetadataRoute } from "next";
import { loadStorefront } from "@/lib/api";
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const {
    settings: { profile },
  } = await loadStorefront();
  return {
    id: "/",
    name: `${profile.name} — ${profile.tagline}`,
    short_name: profile.name.slice(0, 20),
    description:
      "Your everyday groceries, delivered with care. বাংলা / English.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#174d2a",
    icons: [
      {
        src: "/icons/freshcart-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/freshcart-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/freshcart-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Shop groceries", url: "/products" },
      { name: "My shopping lists", url: "/lists" },
    ],
  };
}
