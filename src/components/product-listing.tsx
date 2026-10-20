"use client";
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
import {
  Benefits,
  Breadcrumb,
  CategorySidebar,
  ProductCard,
  Modal,
} from "./ui";

export function ProductListing() {
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
  const categoryName =
    categories.find((c) => c.slug === category)?.name ||
    (category === "fruits"
      ? "Fresh Fruits"
      : category === "vegetables"
        ? "Fresh Vegetables"
        : "All Groceries");
  const title = query
    ? `Results for “${query}”`
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
          {f.label}
          <select
            value={f.value}
            onChange={(e) => update({ [f.key]: e.target.value || null })}
          >
            <option value="">All {f.label.toLowerCase()} options</option>
            {f.options.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      ))}
      <Link
        className="text-button"
        href="/products"
        onClick={() => setFiltersOpen(false)}
      >
        Clear all filters
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
                FRESH PICKS, EVERY DAY
              </span>
              <h1>{title}</h1>
              <p>
                {result.total} {result.total === 1 ? "product" : "products"}
                <span>•</span>Goodness for a healthier you.
              </p>
            </div>
            <div className="listing-banner">
              <strong>
                Fresh from farm
                <br />
                to your home.
              </strong>
              <small>
                A little freshness.
                <br />A whole lot of goodness.
              </small>
            </div>
          </div>
          <div className="filter-toolbar">
            <div className="filter-tabs" aria-label="Product categories">
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
                  {tab.label}
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
                Organic
              </button>
            </div>
            <div className="sort-controls">
              <label>
                <SlidersHorizontal size={15} />
                <span className="sr-only">Maximum price</span>
                <select
                  value={maxPrice || ""}
                  onChange={(e) => update({ maxPrice: e.target.value || null })}
                >
                  <option value="">Any price</option>
                  <option value="50">Under ৳50</option>
                  <option value="100">Under ৳100</option>
                  <option value="200">Under ৳200</option>
                </select>
              </label>
              <label>
                <span className="sort-label">Sort:</span>
                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value })}
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="rating">Top rated</option>
                  <option value="name">Name: A–Z</option>
                </select>
              </label>
            </div>
          </div>
          <div className="desktop-facets">{facets}</div>
          <button
            className="button outline mobile-filter-trigger"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={17} /> More filters{" "}
            {[brand, dietary, pack].filter(Boolean).length || ""}
          </button>
          {filtersOpen && (
            <Modal
              title="Filter groceries"
              onClose={() => setFiltersOpen(false)}
            >
              {facets}
              <button
                className="button primary"
                onClick={() => setFiltersOpen(false)}
              >
                Show {result.total} products
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
                  Offers
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
                  Under ৳{maxPrice}
                  <X size={12} />
                </button>
              )}
              {savedOnly && (
                <button onClick={() => update({ saved: null })}>
                  Saved items
                  <X size={12} />
                </button>
              )}
              <Link href="/products">Clear all</Link>
              {[brand, dietary, pack].filter(Boolean).map((v) => (
                <span className="filter-chip" key={v}>
                  {v}
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
                {savedOnly
                  ? "Your favourites start here"
                  : "No groceries found"}
              </h2>
              <p>
                {savedOnly
                  ? "Tap the heart on any product to save it for later."
                  : "Try a different search or clear a few filters."}
              </p>
              <Link href="/products" className="button primary">
                Browse all groceries
              </Link>
            </div>
          )}
          {result.totalPages > 1 && (
            <nav className="pagination" aria-label="Product pages">
              <button
                disabled={result.page === 1}
                onClick={() => update({ page: String(result.page - 1) })}
                aria-label="Previous page"
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
                aria-label="Next page"
              >
                <ChevronRight size={17} />
              </button>
            </nav>
          )}
          <p className="results-note">
            Showing {result.total ? (result.page - 1) * 8 + 1 : 0}–
            {Math.min(result.page * 8, result.total)} of {result.total} products
          </p>
        </div>
      </div>
      <Benefits />
    </div>
  );
}
