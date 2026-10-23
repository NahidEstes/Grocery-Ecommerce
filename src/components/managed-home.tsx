"use client";
import type { CSSProperties } from "react";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { ArrowRight, Leaf, ShieldCheck, Truck } from "lucide-react";
import { useShop } from "./shop-provider";
import { HomeExtras } from "./storefront-extras";
import { ActiveOrderBanner, HomeShoppingHub } from "./home-shopping";
import {
  Benefits,
  CategorySidebar,
  ProductCard,
  ProductImage,
  SectionTitle,
} from "./ui";
export function ManagedHomePage() {
  const { t } = useLanguage();
  const { catalog, content } = useShop();
  const deals = ["banana", "apple", "milk", "bread"].flatMap(
    (id) => catalog.find((p) => p.id === id) || [],
  );
  return (
    <div className="page-container home-page">
      <div className="shop-layout">
        <CategorySidebar />
        <div className="shop-content">
          {content.showActiveOrder && <ActiveOrderBanner />}
          <section
            className="hero"
            style={
              content.hero.imageUrl
                ? ({
                    "--hero-image": `url("${content.hero.imageUrl}")`,
                  } as CSSProperties)
                : undefined
            }
          >
            <div className="hero-copy">
              <span className="eyebrow">
                <Leaf size={17} />
                {t(content.hero.eyebrow)}
              </span>
              <h1>
                {t(content.hero.title)}
                <br />
                <span>{t(content.hero.highlight)}</span>
              </h1>
              <p>{t(content.hero.description)}</p>
              <Link href={content.hero.href} className="button primary">
                {t(content.hero.button)}
                <ArrowRight size={19} />
              </Link>
              <div className="hero-benefits">
                <span>
                  <Leaf size={22} />
                  {t("Fresh & quality")}
                  <br />
                  {t("products")}
                </span>
                <span>
                  <Truck size={22} />
                  {t("Fast & reliable")}
                  <br />
                  {t("delivery")}
                </span>
                <span>
                  <ShieldCheck size={22} />
                  {t("Everyday")}
                  <br />
                  {t("great prices")}
                </span>
              </div>
            </div>
            <span className="fresh-seal">
              {t("Fresh")}
              <br />
              {t("choices.")}
              <br />
              <em>{t("Brighter days!")}</em>
              <Leaf size={19} />
            </span>
          </section>
          {content.showRegular && <HomeShoppingHub />}
          <div className="promo-grid">
            {content.banners.map((banner, index) => (
              <Link
                href={banner.href}
                key={index}
                className={`promo-banner ${index ? "pantry-promo" : "produce-promo"}`}
                style={
                  banner.imageUrl
                    ? {
                        backgroundImage: `linear-gradient(90deg,#ffffffee,#ffffff44),url("${banner.imageUrl}")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <div>
                  <span className="eyebrow">{t(banner.eyebrow)}</span>
                  <h2>{t(banner.title)}</h2>
                  <p>{t(banner.description)}</p>
                  <span className={`mini-button ${index ? "orange" : "green"}`}>
                    {t(banner.button)}
                    <ArrowRight size={15} />
                  </span>
                </div>
                {!banner.imageUrl && (
                  <div className="promo-products">
                    {(index ? ["oil", "bread"] : ["broccoli", "tomato"]).map(
                      (id) => {
                        const p = catalog.find((p) => p.id === id);
                        return p ? <ProductImage product={p} key={id} /> : null;
                      },
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
          {content.showDeals && (
            <>
              <SectionTitle
                title={content.dealsTitle}
                subtitle={t("Great prices on your everyday favourites.")}
                href="/products?offers=true"
                linkText={t("See all deals")}
              />
              <div className="product-grid home-products">
                {deals.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <HomeExtras />
      <Benefits />
      <section className="fresh-note">
        <div>
          <span className="eyebrow">{t("A LITTLE EXTRA GOODNESS")}</span>
          <h2>{t("Fresh finds for your everyday.")}</h2>
          <p>
            {t("From the first cup of the morning to the last bite of dinner.")}
          </p>
        </div>
        <Link href="/products" className="button outline">
          {t("Explore all groceries")}
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
