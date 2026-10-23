"use client";
import { useLanguage } from "./language-provider";

import {
  Heart,
  Leaf,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Check,
  Clock3,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/catalog";
import { money } from "@/lib/commerce";
import { useShop } from "./shop-provider";
import { unitPrice } from "@/lib/storefront";
import { ProductReviews } from "./product-reviews";
import {
  Benefits,
  Breadcrumb,
  ProductCard,
  ProductImage,
  QuantityControl,
  SectionTitle,
} from "./ui";
export function ProductDetails({
  product: initialProduct,
}: {
  product: Product;
}) {
  const { t, locale } = useLanguage();
  const {
    catalog,
    addItem,
    saved,
    toggleSaved,
    area,
    reviews,
    settings,
    ready,
  } = useShop();
  const [selectedId, setSelectedId] = useState(initialProduct.id);
  const product = catalog.find((p) => p.id === selectedId) || initialProduct;
  const familyId = initialProduct.parentId || initialProduct.id;
  const variants = catalog.filter(
    (p) => (p.id === familyId || p.parentId === familyId) && p.active !== false,
  );
  const productReviews = reviews.filter((r) =>
    variants.some((v) => v.id === r.productId),
  );
  const average = productReviews.length
    ? (
        productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length
      ).toFixed(1)
    : null;
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("Description");
  const [zoomed, setZoomed] = useState(false);
  const [added, setAdded] = useState(false);
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  const related = [
    ...catalog.filter(
      (p) =>
        !p.parentId && p.id !== familyId && p.category === product.category,
    ),
    ...catalog.filter(
      (p) =>
        !p.parentId && p.id !== familyId && p.category !== product.category,
    ),
  ].slice(0, 4);
  return (
    <div className="page-container detail-page">
      <Breadcrumb
        items={[
          { label: "Groceries", href: "/products" },
          {
            label:
              product.category === "fruits"
                ? "Fresh Fruits"
                : product.category.charAt(0).toUpperCase() +
                  product.category.slice(1),
            href: `/products?category=${product.category}`,
          },
          { label: product.name },
        ]}
      />
      <section className="product-detail-layout">
        <div className="gallery">
          <button
            className={`gallery-main ${zoomed ? "zoomed" : ""}`}
            onClick={() => setZoomed(!zoomed)}
            aria-label={t(
              zoomed ? "Zoom out product photo" : "Zoom in product photo",
            )}
          >
            <ProductImage product={product} />
            <span>
              {t(zoomed ? "Click to zoom out" : "Click to take a closer look")}
            </span>
          </button>
          <div className="gallery-thumbnails">
            <button
              className={!zoomed ? "selected" : ""}
              onClick={() => setZoomed(false)}
              aria-label={t("Show full product photo")}
            >
              <ProductImage product={product} />
            </button>
            <button
              className={zoomed ? "selected" : ""}
              onClick={() => setZoomed(true)}
              aria-label={t("Show product close-up")}
            >
              <ProductImage product={product} className="thumbnail-zoom" />
            </button>
            <span>
              <Leaf size={17} />
              {t("Freshly picked.")}
              <br />
              {t("Carefully packed.")}
            </span>
          </div>
        </div>
        <div className="product-info">
          <span className="eyebrow">{t("A FRESH LITTLE FAVOURITE")}</span>
          <h1>{t(product.name)}</h1>
          <div className="product-rating">
            <span>
              <Star size={17} fill="currentColor" />
              {average || t("No reviews yet")}{" "}
              <small>
                {average ? `${productReviews.length} verified reviews` : ""}
              </small>
            </span>
            <i />
            <span className="in-stock">
              <Check size={13} />
              {t(product.stock > 0 ? "In stock" : "Out of stock")}
            </span>
          </div>
          <p className="product-description">{t(product.description)}</p>
          <div className="detail-prices">
            <strong>{money(product.price)}</strong>
            {product.originalPrice && <del>{money(product.originalPrice)}</del>}
            {discount > 0 && (
              <span className="discount-badge">
                {discount}
                {t("% OFF")}
              </span>
            )}
          </div>
          {unitPrice(product, locale) && (
            <p className="unit-comparison">{unitPrice(product, locale)}</p>
          )}
          <div className="purchase-options">
            <label>
              {t("Pack size")}
              <select
                className="pack-size"
                aria-label={t("Pack size")}
                value={product.id}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setQuantity(1);
                  setAdded(false);
                }}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {t(v.unit)} · {money(v.price)}
                    {t(v.stock < 1 ? " · Out of stock" : "")}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label>{t("Quantity")}</label>
              <QuantityControl
                quantity={quantity}
                max={product.stock}
                label={product.name}
                onChange={(value) => setQuantity(Math.max(1, value))}
              />
            </div>
          </div>
          <div className="purchase-actions">
            <button
              className="button primary"
              disabled={!ready || product.stock < 1}
              onClick={() => {
                addItem(product.id, quantity);
                setAdded(true);
                setTimeout(() => setAdded(false), 2500);
              }}
            >
              {added ? <Check size={21} /> : <ShoppingCart size={21} />}{" "}
              {added
                ? t("Added to your cart")
                : `${t("Add to cart")} · ${money(product.price * quantity)}`}
            </button>
            <button
              className={`wishlist-button ${saved.includes(product.id) ? "saved" : ""}`}
              onClick={() => toggleSaved(product.id)}
              aria-pressed={saved.includes(product.id)}
              aria-label={t(
                saved.includes(product.id)
                  ? "Remove from saved items"
                  : "Add to saved items",
              )}
            >
              <Heart
                size={23}
                fill={saved.includes(product.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <p className="purchase-note">
            <ShieldCheck size={15} />
            {t("Freshness checked. Packed with care.")}
          </p>
        </div>
        <aside className="delivery-panel">
          <div className="delivery-card">
            <div>
              <Truck size={25} />
              <span>
                <strong>
                  {t("Delivery to ")}
                  {area}
                </strong>
                <small>{t("Dhaka · Delivered with care")}</small>
              </span>
            </div>
            <div>
              <Clock3 size={25} />
              <span>
                <strong>{t("Choose your delivery slot")}</strong>
                <small>{t("Available times shown at checkout.")}</small>
              </span>
            </div>
            <div>
              <Truck size={25} />
              <span>
                <strong>{t("Free delivery")}</strong>
                <small>
                  {t("On orders of ")}
                  {money(settings.freeDeliveryAt)}+
                </small>
              </span>
            </div>
            <div>
              <Leaf size={25} />
              <span>
                <strong>{t("Freshness guarantee")}</strong>
                <small>{t("Quality you can trust")}</small>
              </span>
            </div>
          </div>
          <div className="quality-card">
            <div>
              <ShieldCheck size={26} />
              <span>
                <strong>{t("Picked for quality")}</strong>
                <small>{t("Fresh & carefully selected")}</small>
              </span>
            </div>
            <div>
              <RotateCcw size={25} />
              <span>
                <strong>{t("Something not quite right?")}</strong>
                <small>{t("Let us know when it arrives.")}</small>
              </span>
            </div>
          </div>
        </aside>
      </section>
      <div className="mobile-purchase-bar">
        <span>
          <strong>{money(product.price * quantity)}</strong>
          <small>{t(product.unit)}</small>
        </span>
        <button
          className="button primary"
          disabled={!ready || product.stock < 1}
          onClick={() => addItem(product.id, quantity)}
        >
          <ShoppingCart size={18} />
          {t(" Add to cart")}
        </button>
      </div>
      <section className="product-tabs">
        <div role="tablist" aria-label={t("Product information")}>
          {["Description", "Storage & care", "Details"].map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              aria-controls="product-tab-panel"
              id={`tab-${item.replaceAll(" ", "-")}`}
              className={tab === item ? "selected" : ""}
              onClick={() => setTab(item)}
            >
              {t(item)}
            </button>
          ))}
        </div>
        <div
          className="tab-content"
          id="product-tab-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
        >
          {tab === "Description" ? (
            <p>
              {t(product.description)}
              {t(
                " Product images are illustrative; natural produce may vary in size, shape and colour.",
              )}
            </p>
          ) : tab === "Storage & care" ? (
            <p>
              {t(
                product.storage ||
                  "Supplier storage instructions have not been supplied. Check the product packaging before use.",
              )}
            </p>
          ) : (
            <dl>
              <div>
                <dt>{t("Pack size")}</dt>
                <dd>{t(product.unit)}</dd>
              </div>
              <div>
                <dt>{t("Availability")}</dt>
                <dd>{t(product.stock > 0 ? "In stock" : "Out of stock")}</dd>
              </div>
              <div>
                <dt>{t("Product code")}</dt>
                <dd>FC-{product.id.toUpperCase()}</dd>
              </div>
              {(
                [
                  ["Brand", product.brand],
                  ["Origin", product.origin],
                  ["Nutrition", product.nutrition],
                  ["Allergens", product.allergens],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd>{t(value || "Not supplied — check the packaging.")}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
      <ProductReviews productIds={variants.map((v) => v.id)} />
      <SectionTitle
        title={t("You may also like")}
        subtitle={t("A few more good things for your basket.")}
        href="/products"
        linkText={t("See more")}
      />
      <div className="product-grid related-products">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <Benefits />
    </div>
  );
}
