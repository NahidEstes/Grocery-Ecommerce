"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Grid2X2,
  Home,
  MapPin,
  Package,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import { useShop } from "./shop-provider";
import { money } from "@/lib/commerce";
import type { Product } from "@/lib/catalog";
import { ProductCard, ProductImage, SectionTitle } from "./ui";
import { deliveryDays } from "@/lib/orders";

export function DeliveryChecker() {
  const { settings, area, setArea, storeError } = useShop();
  const [selected, setSelected] = useState(area),
    [checked, setChecked] = useState(false);
  const zone = settings.zones.find((z) => z.name === selected);
  const available = deliveryDays().find((d) =>
    d.slots.some((s) => settings.slots.some((v) => v.id === s.id && v.enabled)),
  );
  return (
    <section className="delivery-checker">
      <span className="round-icon">
        <Truck size={28} />
      </span>
      <div>
        <span className="eyebrow">FRESHNESS, A LITTLE CLOSER</span>
        <h2>Do we deliver to your door?</h2>
        <p>Check your area before you fill your basket.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setChecked(true);
          if (zone?.enabled) setArea(selected);
        }}
      >
        <label className="sr-only" htmlFor="coverage-area">
          Delivery area
        </label>
        <select
          id="coverage-area"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setChecked(false);
          }}
        >
          <option value="">Choose an area</option>
          {settings.zones.map((z) => (
            <option key={z.name}>{z.name}</option>
          ))}
          <option value="other">Another area</option>
        </select>
        <button className="button primary">
          Check area <ArrowRight size={16} />
        </button>
      </form>
      {checked && (
        <p className="coverage-result" role="status">
          {storeError
            ? storeError
            : zone?.enabled
              ? `${selected}: ${money(zone.fee)} delivery, free from ${money(settings.freeDeliveryAt)}. ${available ? `Next available: ${available.label}, ${available.short} (Dhaka time).` : "No delivery slots currently available."} ${zone.estimate}`
              : "We do not currently deliver to this area."}
        </p>
      )}
    </section>
  );
}
function Shelf({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle: string;
  products: Product[];
}) {
  return (
    <section className="extra-shelf">
      <SectionTitle title={title} subtitle={subtitle} href="/products" />
      <div className="product-grid home-products">
        {products.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {!products.length && (
        <div className="quiet-empty">
          Fresh picks will appear here when the store adds them.
        </div>
      )}
    </section>
  );
}
export function HomeExtras() {
  const { settings, catalog, addMany, popularIds, reviews, storeError, ready } =
    useShop();
  const available = catalog.filter((p) => !p.parentId && p.active !== false);
  const seasonal = available.filter((p) => p.seasonal);
  const arrivals = available
    .filter((p) => p.createdAt)
    .sort((a, b) => b.createdAt!.localeCompare(a.createdAt!));
  return (
    <div className="home-extras">
      <SectionTitle
        title="A fresh start in every aisle"
        subtitle="Your everyday essentials, just a tap away."
        href="/products"
        linkText="All groceries"
      />
      <div className="category-tiles">
        {settings.categories.map((c) => {
          const p = catalog.find(
            (p) =>
              p.category === c.slug ||
              (c.slug === "produce" &&
                ["fruits", "vegetables"].includes(p.category)),
          );
          return (
            <Link href={`/products?category=${c.slug}`} key={c.slug}>
              <ProductImage
                product={p || ({ name: c.name, atlas: c.atlas } as Product)}
              />
              <strong>{c.name}</strong>
              <span>
                Explore aisle <ArrowRight size={13} />
              </span>
            </Link>
          );
        })}
      </div>
      <DeliveryChecker />
      {storeError && (
        <p className="form-error" role="alert">
          {storeError}
        </p>
      )}
      {settings.homeSections.bundles && (
        <section className="bundle-section">
          <SectionTitle
            title="Good things come together"
            subtitle="Thoughtful baskets for your everyday. Each item, clearly priced."
          />
          <div className="bundle-grid">
            {settings.bundles
              .filter((b) => b.active)
              .map((bundle) => {
                const items = bundle.items.map((i) => ({
                  ...i,
                  product: catalog.find((p) => p.id === i.productId),
                }));
                const inStock = items.every(
                  (i) =>
                    i.product &&
                    i.product.active !== false &&
                    i.product.stock >= i.quantity,
                );
                const total = items.reduce(
                  (n, i) => n + (i.product?.price || 0) * i.quantity,
                  0,
                );
                return (
                  <article className="bundle-card" key={bundle.id}>
                    <div className="bundle-photos">
                      {items
                        .slice(0, 3)
                        .map(
                          (i) =>
                            i.product && (
                              <ProductImage
                                key={i.productId}
                                product={i.product}
                              />
                            ),
                        )}
                    </div>
                    <span className="eyebrow">EVERYDAY BASKET</span>
                    <h3>{bundle.name}</h3>
                    <p>{bundle.description}</p>
                    <details>
                      <summary>{items.length} products · View basket</summary>
                      <ul>
                        {items.map((i) => (
                          <li key={i.productId}>
                            {i.quantity} ×{" "}
                            {i.product?.name || "Unavailable product"}{" "}
                            {i.product && (
                              <small>
                                {i.product.unit} ·{" "}
                                {money(i.product.price * i.quantity)}
                              </small>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="bundle-bottom">
                      <strong>{money(total)}</strong>
                      <button
                        disabled={!ready || !inStock}
                        className="button primary"
                        onClick={() => addMany(bundle.items, true)}
                      >
                        {inStock ? "Add basket" : "Unavailable"}{" "}
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      )}
      {settings.homeSections.seasonal && (
        <Shelf
          title="In season, full of goodness"
          subtitle="Seasonal picks selected by the store."
          products={seasonal}
        />
      )}
      {settings.homeSections.arrivals && (
        <Shelf
          title="Meet the new arrivals"
          subtitle="The latest additions to your everyday shop."
          products={arrivals}
        />
      )}
      {settings.homeSections.popular && (
        <section className="extra-shelf">
          <SectionTitle
            title="Your neighbourhood favourites"
            subtitle="Based on completed customer deliveries."
          />
          {popularIds.length ? (
            <div className="product-grid home-products">
              {popularIds
                .map((id) => available.find((p) => p.id === id))
                .filter((p): p is Product => !!p)
                .slice(0, 4)
                .map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
            </div>
          ) : (
            <div className="quiet-empty">
              Popular products will appear after the first completed customer
              deliveries.
            </div>
          )}
        </section>
      )}
      {settings.homeSections.reviews && (
        <section className="review-section">
          <SectionTitle
            title="From our customers’ kitchens"
            subtitle="Real words from verified purchases."
          />
          {reviews.length ? (
            <div className="review-grid">
              {reviews.slice(0, 3).map((r) => (
                <article key={r.id}>
                  <span
                    className="review-stars"
                    aria-label={`${r.rating} out of 5`}
                  >
                    {"★".repeat(r.rating)}
                  </span>
                  <p>“{r.text}”</p>
                  <strong>{r.author}</strong>
                  <small>
                    <Check size={13} /> Verified purchase
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="quiet-empty">
              <Star size={20} /> Your story belongs here. Reviews open after a
              completed purchase.
            </div>
          )}
        </section>
      )}
      <section className="faq-section">
        <div>
          <span className="eyebrow">A LITTLE HELP, WHEN YOU NEED IT</span>
          <h2>
            Good questions.
            <br />
            Fresh answers.
          </h2>
          <p>Everything you need for an easier grocery shop.</p>
          <Link href="/orders">
            Get help with an order <ArrowRight size={15} />
          </Link>
        </div>
        <div>
          {settings.faqs.map((f) => (
            <details key={f.question}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
export function MobileNavigation() {
  const pathname = usePathname();
  const { items } = useShop();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {[
        { href: "/", label: "Home", icon: Home },
        { href: "/products", label: "Categories", icon: Grid2X2 },
        { href: "/cart", label: "Cart", icon: ShoppingCart },
        { href: "/orders", label: "Orders", icon: Package },
      ].map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            href={href}
            key={href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span>
              <Icon size={21} />
              {label === "Cart" && count > 0 && <b>{count}</b>}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
