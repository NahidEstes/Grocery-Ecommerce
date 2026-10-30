"use client";
import { useStoreFormat } from "./store-format";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Leaf,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useTransition, useState } from "react";
import { categories, filterProducts } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { api } from "@/lib/client-api";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
import {
  Benefits,
  Breadcrumb,
  CategorySidebar,
  ProductCard,
  Modal,
} from "./ui";

export function ProductListing() {
  const { money } = useStoreFormat();
  const { t } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const latestQuery = useRef(params.toString());
  useEffect(() => {
    if (!pending) latestQuery.current = params.toString();
  }, [params, pending]);
  const { catalog, saved } = useShop();
  const category = params.get("category") || "";
  const query = params.get("q") || "";
  const organic = params.get("organic") === "true";
  const offers = params.get("offers") === "true";
  const savedOnly = params.get("saved") === "true";
  const sort = params.get("sort") || "featured";
  const maxPrice = params.get("maxPrice");
  const page = Number(params.get("page")) || 1;
  const brand = params.get("brand") || "",
    dietary = params.get("dietary") || "",
    pack = params.get("pack") || "";
  const baseCatalog = savedOnly
    ? catalog.filter((p) => saved.includes(p.id))
    : catalog;
  const result = filterProducts(baseCatalog, {
    category,
    q: query,
    organic,
    offers,
    sort,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    page,
    limit: 8,
    includeVariants: savedOnly,
    brand,
    dietary,
    pack,
  });
  useEffect(() => {
    if (BROWSER_DEMO) return;
    if (query.trim().length < 2 || result.total || !catalog.length) return;
    const timer = setTimeout(() => {
      void api("/search-misses", {
        method: "POST",
        body: JSON.stringify({ query: query.trim().slice(0, 80) }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [query, result.total, catalog]);
  const categoryName =
    categories.find((c) => c.slug === category)?.name ||
    (category === "fruits"
      ? "Fresh Fruits"
      : category === "vegetables"
        ? "Fresh Vegetables"
        : "All Groceries");
  const title = query
    ? t("Results for “{query}”", { query })
    : savedOnly
      ? "Your saved favourites"
      : offers
        ? "Today’s best deals"
        : categoryName;
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(latestQuery.current);
    if (!("page" in changes)) next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    latestQuery.current = next.toString();
    startTransition(() =>
      router.push(`/products${next.size ? `?${next}` : ""}`, { scroll: false }),
    );
  }
  const facets = (
    <div className="facet-fields">
      {[
        {
          key: "brand",
          label: "Brand",
          value: brand,
          options: [
            ...new Set(
              catalog
                .filter((p) => p.active !== false)
                .map((p) => p.brand)
                .filter((v): v is string => !!v),
            ),
          ],
        },
        {
          key: "dietary",
          label: "Dietary preference",
          value: dietary,
          options: [...new Set(catalog.flatMap((p) => p.dietary || []))],
        },
        {
          key: "pack",
          label: "Pack size",
          value: pack,
          options: [
            ...new Set(
              catalog.filter((p) => p.active !== false).map((p) => p.unit),
            ),
          ],
        },
      ].map((f) => (
        <label key={f.key}>
          {t(f.label)}
          <select
            value={f.value}
            onChange={(e) => update({ [f.key]: e.target.value || null })}
          >
            <option value="">
              {t("All {label} options", { label: t(f.label) })}
            </option>
            {f.options.map((v) => (
              <option value={v} key={v}>
                {t(v)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <Link
        className="text-button"
        href="/products"
        onClick={() => setFiltersOpen(false)}
      >
        {t("Clear all filters")}
      </Link>
    </div>
  );
  return (
    <div className="page-container listing-page">
      <div className="shop-layout">
        <CategorySidebar
          active={
            category === "fruits" || category === "vegetables"
              ? "produce"
              : category
          }
        />
        <div className="shop-content">
          <Breadcrumb items={[{ label: title }]} />
          <div className="listing-heading">
            <div>
              <span className="eyebrow">
                <Leaf size={14} />
                {t("FRESH PICKS, EVERY DAY")}
              </span>
              <h1>{t(title)}</h1>
              <p>
                {result.total} {t(result.total === 1 ? "product" : "products")}
                <span>•</span>
                {t("Goodness for a healthier you.")}
              </p>
            </div>
            <div className="listing-banner">
              <strong>
                {t("Fresh from farm")}
                <br />
                {t("to your home.")}
              </strong>
              <small>
                {t("A little freshness.")}
                <br />
                {t("A whole lot of goodness.")}
              </small>
            </div>
          </div>
          <div className="filter-toolbar">
            <div className="filter-tabs" aria-label={t("Product categories")}>
              {[
                {
                  label: "All",
                  value:
                    category === "produce" ||
                    category === "fruits" ||
                    category === "vegetables"
                      ? "produce"
                      : "",
                },
                { label: "Vegetables", value: "vegetables" },
                { label: "Fruits", value: "fruits" },
              ].map((tab) => (
                <button
                  key={tab.label}
                  className={
                    !organic &&
                    (category === tab.value ||
                      (tab.label === "All" &&
                        !["fruits", "vegetables"].includes(category)))
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    update({ category: tab.value || null, organic: null })
                  }
                >
                  {t(tab.label)}
                </button>
              ))}
              <button
                className={organic ? "selected" : ""}
                onClick={() =>
                  update({
                    organic: organic ? null : "true",
                    category: "produce",
                  })
                }
              >
                <Leaf size={13} />
                {t("Organic")}
              </button>
            </div>
            <div className="sort-controls">
              <label>
                <SlidersHorizontal size={15} />
                <span className="sr-only">{t("Maximum price")}</span>
                <select
                  value={maxPrice || ""}
                  onChange={(e) => update({ maxPrice: e.target.value || null })}
                >
                  <option value="">{t("Any price")}</option>
                  <option value={BROWSER_DEMO ? "3" : "50"}>
                    {t("Under")} {money(BROWSER_DEMO ? 3 : 50)}
                  </option>
                  <option value={BROWSER_DEMO ? "5" : "100"}>
                    {t("Under")} {money(BROWSER_DEMO ? 5 : 100)}
                  </option>
                  <option value={BROWSER_DEMO ? "10" : "200"}>
                    {t("Under")} {money(BROWSER_DEMO ? 10 : 200)}
                  </option>
                </select>
              </label>
              <label>
                <span className="sort-label">{t("Sort:")}</span>
                <select
                  aria-label={t("Sort products")}
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value })}
                >
                  <option value="featured">{t("Featured")}</option>
                  <option value="price-asc">{t("Price: low to high")}</option>
                  <option value="price-desc">{t("Price: high to low")}</option>
                  <option value="rating">{t("Top rated")}</option>
                  <option value="name">{t("Name: A–Z")}</option>
                </select>
              </label>
            </div>
          </div>
          <div className="desktop-facets">{facets}</div>
          <button
            className="button outline mobile-filter-trigger"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={17} />
            {t(" More filters")}{" "}
            {[brand, dietary, pack].filter(Boolean).length || ""}
          </button>
          {filtersOpen && (
            <Modal
              title={t("Filter groceries")}
              onClose={() => setFiltersOpen(false)}
            >
              {facets}
              <button
                className="button primary"
                onClick={() => setFiltersOpen(false)}
              >
                {t("Show ")}
                {result.total}
                {t(" products")}
              </button>
            </Modal>
          )}
          {(offers ||
            query ||
            maxPrice ||
            savedOnly ||
            brand ||
            dietary ||
            pack ||
            organic ||
            category) && (
            <div className="active-filters">
              {offers && (
                <button onClick={() => update({ offers: null })}>
                  {t("Offers")}
                  <X size={12} />
                </button>
              )}
              {query && (
                <button onClick={() => update({ q: null })}>
                  {query}
                  <X size={12} />
                </button>
              )}
              {maxPrice && (
                <button onClick={() => update({ maxPrice: null })}>
                  {t("Under")}
                  {money(Number(maxPrice))}
                  <X size={12} />
                </button>
              )}
              {savedOnly && (
                <button onClick={() => update({ saved: null })}>
                  {t("Saved items")}
                  <X size={12} />
                </button>
              )}
              <Link href="/products">{t("Clear all")}</Link>
              {[brand, dietary, pack].filter(Boolean).map((v) => (
                <span className="filter-chip" key={v}>
                  {t(v)}
                </span>
              ))}
            </div>
          )}
          <div
            className={`product-grid listing-products ${pending ? "is-pending" : ""}`}
            aria-busy={pending}
          >
            {result.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {!result.total && (
            <div className="empty-state">
              <SearchX size={46} />
              <h2>
                {t(
                  savedOnly
                    ? "Your favourites start here"
                    : "No groceries found",
                )}
              </h2>
              <p>
                {t(
                  savedOnly
                    ? "Tap the heart on any product to save it for later."
                    : "Try a different search or clear a few filters.",
                )}
              </p>
              <Link href="/products" className="button primary">
                {t("Browse all groceries")}
              </Link>
            </div>
          )}
          {result.totalPages > 1 && (
            <nav className="pagination" aria-label={t("Product pages")}>
              <button
                disabled={result.page === 1}
                onClick={() => update({ page: String(result.page - 1) })}
                aria-label={t("Previous page")}
              >
                <ChevronLeft size={17} />
              </button>
              {Array.from({ length: result.totalPages }, (_, i) => (
                <button
                  key={i}
                  aria-current={result.page === i + 1 ? "page" : undefined}
                  className={result.page === i + 1 ? "selected" : ""}
                  onClick={() => update({ page: String(i + 1) })}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={result.page === result.totalPages}
                onClick={() => update({ page: String(result.page + 1) })}
                aria-label={t("Next page")}
              >
                <ChevronRight size={17} />
              </button>
            </nav>
          )}
          <p className="results-note">
            {t("Showing ")}
            {result.total ? (result.page - 1) * 8 + 1 : 0}–
            {Math.min(result.page * 8, result.total)}
            {t(" of ")}
            {result.total}
            {t(" products")}
          </p>
        </div>
      </div>
      <Benefits />
    </div>
  );
}
