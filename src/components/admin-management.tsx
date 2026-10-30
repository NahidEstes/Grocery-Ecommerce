"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { ContentConfig } from "@/lib/management";
import type { Recipe } from "@/lib/recipes";
import type { Product } from "@/lib/catalog";
import { HomepageEditor, RecipeManager } from "./admin-content";
import {
  ReportsPanel,
  InventoryPanel,
  ActivityPanel,
  TeamPanel,
  SearchSettings,
  CatalogTools,
  ReturnsPanel,
} from "./admin-operations";
import { Notice } from "./admin-shared";
import { PurchasingPanel } from "./admin-purchasing";
import { ContentLanguages } from "./admin-languages";
export function ManagementPanel({
  tab,
  products,
  reload,
}: {
  tab: string;
  products: Product[];
  reload: () => Promise<void>;
}) {
  const [data, setData] = useState<{
      content: ContentConfig;
      recipes: Recipe[];
    }>(),
    [error, setError] = useState("");
  async function loadContent() {
    setData(await api("/admin/content"));
  }
  useEffect(() => {
    if (["recipes", "homepage", "search"].includes(tab))
      void loadContent().catch((e) => setError(e.message));
  }, [tab]);
  async function saveContent(content: ContentConfig) {
    const result = await api<{ content: ContentConfig }>("/admin/content", {
      method: "PUT",
      body: JSON.stringify(content),
    });
    setData((p) => (p ? { ...p, content: result.content } : p));
    return result.content;
  }
  if (tab === "reports") return <ReportsPanel />;
  if (tab === "purchasing") return <PurchasingPanel reload={reload} />;
  if (tab === "languages")
    return <ContentLanguages products={products} reload={reload} />;
  if (tab === "inventory") return <InventoryPanel products={products} />;
  if (tab === "activity") return <ActivityPanel />;
  if (tab === "team") return <TeamPanel />;
  if (tab === "catalog-tools")
    return <CatalogTools products={products} reload={reload} />;
  if (tab === "returns") return <ReturnsPanel products={products} />;
  if (error) return <Notice error={error} />;
  if (!data)
    return (
      <div className="loading-state" role="status">
        Opening your management tools…
      </div>
    );
  if (tab === "recipes")
    return (
      <RecipeManager
        recipes={data.recipes}
        products={products}
        reload={loadContent}
      />
    );
  if (tab === "homepage")
    return <HomepageEditor initial={data.content} onSave={saveContent} />;
  if (tab === "search")
    return (
      <SearchSettings
        initial={data.content}
        products={products}
        onSave={saveContent}
      />
    );
  return null;
}
