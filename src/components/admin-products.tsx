"use client";
import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/storefront";
import {
  emptyProductFilters,
  filterAdminProducts,
  isLowStock,
  type ProductFilters,
} from "@/lib/admin-products";
import { ProductImage } from "./ui";
import { useStoreFormat } from "./store-format";

export function AdminProducts({
  products,
  settings,
  threshold,
  edit,
  bulk,
}: {
  products: Product[];
  settings: StoreSettings;
  threshold: number;
  edit: (product: Product | null) => void;
  bulk: () => void;
}) {
  const { money } = useStoreFormat();
  const [filters, setFilters] = useState<ProductFilters>({
      ...emptyProductFilters,
    }),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(12),
    [more, setMore] = useState(false);
  const result = filterAdminProducts(products, filters, threshold),
    pages = Math.max(1, Math.ceil(result.length / pageSize)),
    current = Math.min(page, pages),
    visible = result.slice((current - 1) * pageSize, current * pageSize);
  const categories = [
    ...new Map(
      [
        ...settings.categories,
        ...products
          .filter(
            (product) =>
              !settings.categories.some(
                (category) => category.slug === product.category,
              ),
          )
          .map((product) => ({
            slug: product.category,
            name: product.category,
            atlas: product.atlas,
          })),
      ].map((category) => [category.slug, category]),
    ).values(),
  ];
  const active = products.filter((product) => product.active !== false),
    low = products.filter((product) => isLowStock(product, threshold));
  function update(value: Partial<ProductFilters>) {
    setFilters((previous) => ({ ...previous, ...value }));
    setPage(1);
  }
  const filtered = !!(
    filters.query ||
    filters.category ||
    filters.visibility ||
    filters.stock
  );
  function clear() {
    setFilters({ ...emptyProductFilters });
    setPage(1);
  }
  return (
    <div className="workspace-products">
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">A WELL-KEPT CATALOG</span>
          <h1>Products & stock</h1>
          <p>Find a product, check its packs and make your next update.</p>
        </div>
        <div className="product-catalog-actions">
          <button className="button outline" onClick={bulk}>
            <Download size={16} />
            Bulk tools & CSV
          </button>
          <button className="button primary" onClick={() => edit(null)}>
            <Plus size={17} />
            Add product
          </button>
        </div>
      </div>
      <div className="product-catalog-stats">
        {[
          {
            label: "All products & packs",
            value: products.length,
            icon: Boxes,
            go: () => update({ visibility: "", stock: "" }),
          },
          {
            label: "Visible in store",
            value: active.length,
            icon: Eye,
            go: () => update({ visibility: "active", stock: "" }),
          },
          {
            label: "Low-stock alerts",
            value: low.length,
            icon: Package,
            go: () => update({ visibility: "", stock: "low" }),
          },
          {
            label: "Hidden products",
            value: products.length - active.length,
            icon: Check,
            go: () => update({ visibility: "hidden", stock: "" }),
          },
        ].map((metric) => (
          <button key={metric.label} onClick={metric.go}>
            <span>
              <metric.icon size={17} />
              {metric.label}
            </span>
            <strong>{metric.value}</strong>
          </button>
        ))}
      </div>
      <section className="workspace-panel product-catalog-panel">
        <div className="product-catalog-toolbar">
          <label className="workspace-order-search">
            <Search size={18} />
            <input
              aria-label="Find products"
              placeholder="Search name, SKU or বাংলা keywords…"
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
            />
            {filters.query && (
              <button
                onClick={() => update({ query: "" })}
                aria-label="Clear product search"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <div>
            <button
              className={`button outline ${more ? "workspace-filter-active" : ""}`}
              aria-expanded={more}
              aria-controls="product-catalog-filters"
              onClick={() => setMore(!more)}
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>
            <label className="workspace-sort">
              <ArrowDownWideNarrow size={17} />
              <select
                aria-label="Sort products"
                value={filters.sort}
                onChange={(event) => update({ sort: event.target.value })}
              >
                <option value="name">Name A–Z</option>
                <option value="newest">Newest added</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="stock">Stock: low to high</option>
              </select>
            </label>
          </div>
        </div>
        {more && (
          <div className="product-catalog-filters" id="product-catalog-filters">
            <label>
              Category
              <select
                aria-label="Filter product category"
                value={filters.category}
                onChange={(event) => update({ category: event.target.value })}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select
                aria-label="Filter product visibility"
                value={filters.visibility}
                onChange={(event) => update({ visibility: event.target.value })}
              >
                <option value="">All products</option>
                <option value="active">Visible in store</option>
                <option value="hidden">Hidden from store</option>
              </select>
            </label>
            <label>
              Stock
              <select
                aria-label="Filter product stock"
                value={filters.stock}
                onChange={(event) => update({ stock: event.target.value })}
              >
                <option value="">All stock levels</option>
                <option value="low">Low-stock alerts</option>
                <option value="out">Out of stock</option>
              </select>
            </label>
            <p>
              Low-stock and out-of-stock alerts apply to visible products. Stock
              quantities are packs.
            </p>
          </div>
        )}
        {filtered && (
          <div className="workspace-active-filters">
            <span>
              <Filter size={13} />
              {result.length} matching products & packs
            </span>
            <button onClick={clear}>
              Clear filters <X size={13} />
            </button>
          </div>
        )}
        {visible.length ? (
          <div className="product-catalog-table-wrap">
            <table className="product-catalog-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Product / SKU</th>
                  <th scope="col">Category</th>
                  <th scope="col">Price per pack</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Visibility</th>
                  <th scope="col">
                    <span className="sr-only">Product actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-catalog-name">
                        <ProductImage product={product} />
                        <div>
                          <button
                            className="product-name-button"
                            onClick={() => edit(product)}
                          >
                            {product.name}
                          </button>
                          <small>
                            {product.unit} · {product.id}
                          </small>
                          {product.parentId && (
                            <span className="product-variant-label">
                              Pack variant ·{" "}
                              {products.find(
                                (item) => item.id === product.parentId,
                              )?.name || product.parentId}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Category">
                      {categories.find(
                        (category) => category.slug === product.category,
                      )?.name || product.category}
                    </td>
                    <td data-label="Price per pack">
                      <strong>{money(product.price)}</strong>
                      {product.originalPrice && (
                        <del>{money(product.originalPrice)}</del>
                      )}
                    </td>
                    <td data-label="Stock">
                      <span
                        className={`product-stock-label ${isLowStock(product, threshold) ? "low" : ""}`}
                      >
                        {product.stock} packs
                      </span>
                      {product.active !== false && product.stock === 0 ? (
                        <small className="product-out-of-stock">
                          Out of stock
                        </small>
                      ) : isLowStock(product, threshold) ? (
                        <small>Low stock</small>
                      ) : null}
                    </td>
                    <td data-label="Visibility">
                      <span
                        className={`product-visibility-badge ${product.active === false ? "hidden" : ""}`}
                      >
                        <i />
                        {product.active === false ? "Hidden" : "Visible"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button outline small"
                        onClick={() => edit(product)}
                        aria-label={`Edit ${product.name} (${product.unit})`}
                      >
                        Edit <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="workspace-empty product-catalog-empty">
            <Search size={30} />
            <h2>
              {products.length
                ? "No products match these filters"
                : "Your catalog is ready for its first product"}
            </h2>
            <p>
              {products.length
                ? "Try a different category, search word or stock filter."
                : "Start with a name, pack size, price and stock."}
            </p>
            <button
              className="button outline"
              onClick={products.length ? clear : () => edit(null)}
            >
              {products.length ? "Clear filters" : "Add product"}
            </button>
          </div>
        )}
        <footer className="workspace-pagination">
          <span>
            {result.length
              ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, result.length)} of ${result.length} products & packs`
              : "0 products"}
          </span>
          <div>
            <label>
              Per page
              <select
                aria-label="Products per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option>12</option>
                <option>24</option>
                <option>48</option>
              </select>
            </label>
            <button
              className="workspace-icon"
              aria-label="Previous products page"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {current} / {pages}
            </span>
            <button
              className="workspace-icon"
              aria-label="Next products page"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
