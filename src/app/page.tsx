import Link from "next/link";
import { HomeExtras } from "@/components/storefront-extras";
import { ArrowRight, Leaf, ShieldCheck, Truck } from "lucide-react";
import { loadCatalog } from "@/lib/api";
import {
  Benefits,
  CategorySidebar,
  ProductCard,
  ProductImage,
  SectionTitle,
} from "@/components/ui";
export default async function HomePage() {
  const catalog = await loadCatalog();
  const deals = ["banana", "apple", "milk", "bread"].flatMap(
    (id) => catalog.find((p) => p.id === id) || [],
  );
  return (
    <div className="page-container home-page">
      <div className="shop-layout">
        <CategorySidebar />
        <div className="shop-content">
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">
                <Leaf size={17} />
                FRESHER DAYS AHEAD
              </span>
              <h1>
                Your daily essentials,
                <br />
                <span>delivered.</span>
              </h1>
              <p>
                Fresh produce, pantry staples, household essentials
                <br className="desktop-break" /> and more — all at your
                doorstep.
              </p>
              <Link href="/products" className="button primary">
                Start shopping
                <ArrowRight size={19} />
              </Link>
              <div className="hero-benefits">
                <span>
                  <Leaf size={22} />
                  Fresh & quality
                  <br />
                  products
                </span>
                <span>
                  <Truck size={22} />
                  Fast & reliable
                  <br />
                  delivery
                </span>
                <span>
                  <ShieldCheck size={22} />
                  Everyday
                  <br />
                  great prices
                </span>
              </div>
            </div>
            <span className="fresh-seal">
              Fresh
              <br />
              choices.
              <br />
              <em>Brighter days!</em>
              <Leaf size={19} />
            </span>
          </section>
          <div className="promo-grid">
            <Link
              href="/products?category=produce"
              className="promo-banner produce-promo"
            >
              <div>
                <span className="eyebrow">EAT HEALTHY EVERYDAY</span>
                <h2>Fresh Fruits & Vegetables</h2>
                <p>Farm-fresh goodness for a healthier you.</p>
                <span className="mini-button green">
                  Shop fresh produce
                  <ArrowRight size={15} />
                </span>
              </div>
              <div className="promo-products">
                {catalog.find((p) => p.id === "broccoli") && (
                  <ProductImage
                    product={catalog.find((p) => p.id === "broccoli")!}
                  />
                )}{" "}
                {catalog.find((p) => p.id === "tomato") && (
                  <ProductImage
                    product={catalog.find((p) => p.id === "tomato")!}
                  />
                )}
              </div>
            </Link>
            <Link
              href="/products?category=pantry"
              className="promo-banner pantry-promo"
            >
              <div>
                <span className="eyebrow">STOCK UP & SAVE</span>
                <h2>Pantry Essentials</h2>
                <p>Everyday staples at great prices.</p>
                <span className="mini-button orange">
                  Shop pantry
                  <ArrowRight size={15} />
                </span>
              </div>
              <div className="promo-products">
                {catalog.find((p) => p.id === "oil") && (
                  <ProductImage
                    product={catalog.find((p) => p.id === "oil")!}
                  />
                )}{" "}
                {catalog.find((p) => p.id === "bread") && (
                  <ProductImage
                    product={catalog.find((p) => p.id === "bread")!}
                  />
                )}
              </div>
            </Link>
          </div>
          <SectionTitle
            title="Today’s best deals"
            subtitle="Great prices on your everyday favourites."
            href="/products?offers=true"
            linkText="See all deals"
          />
          <div className="product-grid home-products">
            {deals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
      <HomeExtras />
      <Benefits />
      <section className="fresh-note">
        <div>
          <span className="eyebrow">A LITTLE EXTRA GOODNESS</span>
          <h2>Fresh finds for your everyday.</h2>
          <p>From the first cup of the morning to the last bite of dinner.</p>
        </div>
        <Link href="/products" className="button outline">
          Explore all groceries
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
