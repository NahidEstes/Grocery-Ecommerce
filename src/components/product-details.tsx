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
import {
  Benefits,
  Breadcrumb,
  ProductCard,
  ProductImage,
  QuantityControl,
  SectionTitle,
} from "./ui";
export function ProductDetails({ product }: { product: Product }) {
  const { catalog, addItem, saved, toggleSaved, area } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("Description");
  const [zoomed, setZoomed] = useState(false);
  const [added, setAdded] = useState(false);
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  const related = [
    ...catalog.filter(
      (p) => p.id !== product.id && p.category === product.category,
    ),
    ...catalog.filter(
      (p) => p.id !== product.id && p.category !== product.category,
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
              {product.rating} <small>Product rating</small>
            </span>
            <i />
            <span className="in-stock">
              <Check size={13} />
              In stock
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
          <div className="purchase-options">
            <label>
              Pack size
              <span className="pack-size">
                {product.unit}
                <ChevronDown size={16} />
              </span>
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
              disabled={product.stock < 1}
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
                <strong>Same-day delivery</strong>
                <small>Order fresh. Enjoy it today.</small>
              </span>
            </div>
            <div>
              <Truck size={25} />
              <span>
                <strong>Free delivery</strong>
                <small>On orders of ৳1,000+</small>
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
              {["dairy", "meat", "frozen"].includes(product.category)
                ? "Keep refrigerated and follow the use-by date and storage instructions on the packaging."
                : ["fruits", "vegetables"].includes(product.category)
                  ? "Store in a cool place or refrigerate as appropriate. Wash fresh produce thoroughly before eating. Enjoy promptly for the best flavour."
                  : "Store in a cool, dry place. Keep packaging sealed and follow the best-before date."}
            </p>
          ) : (
            <dl>
              <div>
                <dt>Pack size</dt>
                <dd>{product.unit}</dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>In stock</dd>
              </div>
              <div>
                <dt>Product code</dt>
                <dd>FC-{product.id.toUpperCase()}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>
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
