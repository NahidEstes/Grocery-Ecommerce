"use client";
import { useStoreFormat } from "./store-format";
import { useLanguage } from "./language-provider";

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

import type { Product } from "@/lib/catalog";
import { ProductCard, ProductImage, SectionTitle } from "./ui";
import { deliveryDays } from "@/lib/orders";
import { RecipeShelf } from "./recipes";
import type { HomeSectionId } from "@/lib/management";

export function DeliveryChecker({
  title = "Do we deliver to your door?",
}: {
  title?: string;
}) {
  const { money } = useStoreFormat();
  const { t } = useLanguage();
  const { settings, area, setArea, storeError } = useShop();
  const [selected, setSelected] = useState(area),
    [checked, setChecked] = useState(false);
  const zone = settings.zones.find((z) => z.name === selected);
  const available = deliveryDays(new Date(), settings.profile.timeZone).find(
    (d) =>
      d.slots.some((s) =>
        settings.slots.some((v) => v.id === s.id && v.enabled),
      ),
  );
  return (
    <section className="delivery-checker">
      <span className="round-icon">
        <Truck size={28} />
      </span>
      <div>
        <span className="eyebrow">{t("FRESHNESS, A LITTLE CLOSER")}</span>
        <h2>{t(title)}</h2>
        <p>{t("Check your area before you fill your basket.")}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setChecked(true);
          if (zone?.enabled) setArea(selected);
        }}
      >
        <label className="sr-only" htmlFor="coverage-area">
          {t("Delivery area")}
        </label>
        <select
          id="coverage-area"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setChecked(false);
          }}
        >
          <option value="">{t("Choose an area")}</option>
          {settings.zones.map((z) => (
            <option value={z.name} key={z.name}>
              {t(z.name)}
            </option>
          ))}
          <option value="other">{t("Another area")}</option>
        </select>
        <button className="button primary">
          {t("Check area ")}
          <ArrowRight size={16} />
        </button>
      </form>
      {checked && (
        <p className="coverage-result" role="status">
          {storeError
            ? storeError
            : zone?.enabled
              ? `${t("{area}: {fee} delivery, free from {threshold}.", { area: t(selected), fee: money(zone.fee), threshold: money(settings.freeDeliveryAt) })} ${available ? `${t("Next available:")} ${t(available.label)}, ${available.short} (${settings.profile.timeZone}).` : t("No delivery slots currently available.")} ${t(zone.estimate)}`
              : t("We do not currently deliver to this area.")}
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
  const { t } = useLanguage();
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
          {t("Fresh picks will appear here when the store adds them.")}
        </div>
      )}
    </section>
  );
}
export function HomeExtras() {
  const { content } = useShop();
  return (
    <div className="home-extras managed-home-sections">
      {content.sections
        .filter((s) => s.enabled)
        .map((s) => (
          <HomeExtraSection key={s.id} section={s.id} title={s.title} />
        ))}
    </div>
  );
}
function HomeExtraSection({
  section,
  title,
}: {
  section: HomeSectionId;
  title: string;
}) {
  const { money } = useStoreFormat();
  const { t } = useLanguage();
  const { settings, catalog, addMany, popularIds, reviews, storeError, ready } =
    useShop();
  const available = catalog.filter((p) => !p.parentId && p.active !== false);
  const seasonal = available.filter((p) => p.seasonal);
  const arrivals = available
    .filter((p) => p.createdAt)
    .sort((a, b) => b.createdAt!.localeCompare(a.createdAt!));
  if(section==="popular"&&!popularIds.some(id=>available.some(p=>p.id===id)))return null;
  if(section==="reviews"&&!reviews.length)return null;
  return (
    <div className="managed-extra-section">
      {section === "categories" && (
        <>
          <SectionTitle
            title={title}
            subtitle={t("Your everyday essentials, just a tap away.")}
            href="/products"
            linkText={t("All groceries")}
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
                  <strong>{t(c.name)}</strong>
                  <span>
                    {t("Explore aisle ")}
                    <ArrowRight size={13} />
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
      {section === "coverage" && <DeliveryChecker title={title} />}
      {section === "coverage" && storeError && (
        <p className="form-error" role="alert">
          {t(storeError)}
        </p>
      )}
      {section === "bundles" && (
        <section className="bundle-section">
          <SectionTitle
            title={title}
            subtitle={t(
              "Thoughtful baskets for your everyday. Each item, clearly priced.",
            )}
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
                    <span className="eyebrow">{t("EVERYDAY BASKET")}</span>
                    <h3>{t(bundle.name)}</h3>
                    <p>{t(bundle.description)}</p>
                    <details>
                      <summary>
                        {items.length}
                        {t(" products · View basket")}
                      </summary>
                      <ul>
                        {items.map((i) => (
                          <li key={i.productId}>
                            {i.quantity} ×{" "}
                            {t(i.product?.name || "Unavailable product")}{" "}
                            {i.product && (
                              <small>
                                {t(i.product.unit)} ·{" "}
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
                        {t(inStock ? "Add basket" : "Unavailable")}{" "}
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      )}
      {section === "recipes" && <RecipeShelf title={title} />}
      {section === "seasonal" && (
        <Shelf
          title={title}
          subtitle={t("Seasonal picks selected by the store.")}
          products={seasonal}
        />
      )}
      {section === "arrivals" && (
        <Shelf
          title={title}
          subtitle={t("The latest additions to your everyday shop.")}
          products={arrivals}
        />
      )}
      {section === "popular" && (
        <section className="extra-shelf">
          <SectionTitle
            title={title}
            subtitle={t("Based on completed customer deliveries.")}
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
              {t(
                "Popular products will appear after the first completed customer deliveries.",
              )}
            </div>
          )}
        </section>
      )}
      {section === "reviews" && (
        <section className="review-section">
          <SectionTitle
            title={title}
            subtitle={t("Real words from verified purchases.")}
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
                  <p>“{t(r.text)}”</p>
                  <strong>{r.author}</strong>
                  <small>
                    <Check size={13} />
                    {t(" Verified purchase")}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="quiet-empty">
              <Star size={20} />
              {t(
                " Your story belongs here. Reviews open after a completed purchase.",
              )}
            </div>
          )}
        </section>
      )}
      {section === "faq" && (
        <section className="faq-section">
          <div>
            <span className="eyebrow">
              {t("A LITTLE HELP, WHEN YOU NEED IT")}
            </span>
            <h2>{t(title)}</h2>
            <p>{t("Everything you need for an easier grocery shop.")}</p>
            <Link href="/orders">
              {t("Get help with an order ")}
              <ArrowRight size={15} />
            </Link>
          </div>
          <div>
            {settings.faqs.map((f) => (
              <details key={f.question}>
                <summary>{t(f.question)}</summary>
                <p>{t(f.answer)}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export function MobileNavigation() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { items } = useShop();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav className="mobile-bottom-nav" aria-label={t("Mobile navigation")}>
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
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
