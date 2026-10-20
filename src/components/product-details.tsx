"use client";
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
            aria-label={
              zoomed ? "Zoom out product photo" : "Zoom in product photo"
            }
          >
            <ProductImage product={product} />
            <span>
              {zoomed ? "Click to zoom out" : "Click to take a closer look"}
            </span>
          </button>
          <div className="gallery-thumbnails">
            <button
              className={!zoomed ? "selected" : ""}
              onClick={() => setZoomed(false)}
              aria-label="Show full product photo"
            >
              <ProductImage product={product} />
            </button>
            <button
              className={zoomed ? "selected" : ""}
              onClick={() => setZoomed(true)}
              aria-label="Show product close-up"
            >
              <ProductImage product={product} className="thumbnail-zoom" />
            </button>
            <span>
              <Leaf size={17} />
              Freshly picked.
              <br />
              Carefully packed.
            </span>
          </div>
        </div>
        <div className="product-info">
          <span className="eyebrow">A FRESH LITTLE FAVOURITE</span>
          <h1>{product.name}</h1>
          <div className="product-rating">
            <span>
              <Star size={17} fill="currentColor" />
              {average || "No reviews yet"}{" "}
              <small>
                {average ? `${productReviews.length} verified reviews` : ""}
              </small>
            </span>
            <i />
            <span className="in-stock">
              <Check size={13} />
              {product.stock > 0 ? "In stock" : "Out of stock"}
            </span>
          </div>
          <p className="product-description">{product.description}</p>
          <div className="detail-prices">
            <strong>{money(product.price)}</strong>
            {product.originalPrice && <del>{money(product.originalPrice)}</del>}
            {discount > 0 && (
              <span className="discount-badge">{discount}% OFF</span>
            )}
          </div>
          {unitPrice(product) && (
            <p className="unit-comparison">{unitPrice(product)}</p>
          )}
          <div className="purchase-options">
            <label>
              Pack size
              <select
                className="pack-size"
                aria-label="Pack size"
                value={product.id}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setQuantity(1);
                  setAdded(false);
                }}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.unit} · {money(v.price)}
                    {v.stock < 1 ? " · Out of stock" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label>Quantity</label>
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
                ? "Added to your cart"
                : `Add to cart · ${money(product.price * quantity)}`}
            </button>
            <button
              className={`wishlist-button ${saved.includes(product.id) ? "saved" : ""}`}
              onClick={() => toggleSaved(product.id)}
              aria-pressed={saved.includes(product.id)}
              aria-label={
                saved.includes(product.id)
                  ? "Remove from saved items"
                  : "Add to saved items"
              }
            >
              <Heart
                size={23}
                fill={saved.includes(product.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <p className="purchase-note">
            <ShieldCheck size={15} />
            Freshness checked. Packed with care.
          </p>
        </div>
        <aside className="delivery-panel">
          <div className="delivery-card">
            <div>
              <Truck size={25} />
              <span>
                <strong>Delivery to {area}</strong>
                <small>Dhaka · Delivered with care</small>
              </span>
            </div>
            <div>
              <Clock3 size={25} />
              <span>
                <strong>Choose your delivery slot</strong>
                <small>Available times shown at checkout.</small>
              </span>
            </div>
            <div>
              <Truck size={25} />
              <span>
                <strong>Free delivery</strong>
                <small>On orders of {money(settings.freeDeliveryAt)}+</small>
              </span>
            </div>
            <div>
              <Leaf size={25} />
              <span>
                <strong>Freshness guarantee</strong>
                <small>Quality you can trust</small>
              </span>
            </div>
          </div>
          <div className="quality-card">
            <div>
              <ShieldCheck size={26} />
              <span>
                <strong>Picked for quality</strong>
                <small>Fresh & carefully selected</small>
              </span>
            </div>
            <div>
              <RotateCcw size={25} />
              <span>
                <strong>Something not quite right?</strong>
                <small>Let us know when it arrives.</small>
              </span>
            </div>
          </div>
        </aside>
      </section>
      <div className="mobile-purchase-bar">
        <span>
          <strong>{money(product.price * quantity)}</strong>
          <small>{product.unit}</small>
        </span>
        <button
          className="button primary"
          disabled={!ready || product.stock < 1}
          onClick={() => addItem(product.id, quantity)}
        >
          <ShoppingCart size={18} /> Add to cart
        </button>
      </div>
      <section className="product-tabs">
        <div role="tablist" aria-label="Product information">
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
              {item}
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
              {product.description} Product images are illustrative; natural
              produce may vary in size, shape and colour.
            </p>
          ) : tab === "Storage & care" ? (
            <p>
              {product.storage ||
                "Supplier storage instructions have not been supplied. Check the product packaging before use."}
            </p>
          ) : (
            <dl>
              <div>
                <dt>Pack size</dt>
                <dd>{product.unit}</dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>{product.stock > 0 ? "In stock" : "Out of stock"}</dd>
              </div>
              <div>
                <dt>Product code</dt>
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
                  <dt>{label}</dt>
                  <dd>{value || "Not supplied — check the packaging."}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
      <ProductReviews productIds={variants.map((v) => v.id)} />
      <SectionTitle
        title="You may also like"
        subtitle="A few more good things for your basket."
        href="/products"
        linkText="See more"
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
