"use client";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "./language-provider";
import { useStoreFormat } from "./store-format";
import { demoProducts } from "@/lib/browser-demo/data";
import { demoAdminOrders } from "@/lib/browser-demo/orders";
import { ProductImage } from "./ui";

const sections = ["overview", "products", "orders", "inventory"] as const;
type Section = (typeof sections)[number];
export function DemoAdmin({ initialSection }: { initialSection?: string }) {
  const { t, locale } = useLanguage(),
    { money, orderTime } = useStoreFormat();
  const [section, setSection] = useState<Section>(
    sections.includes(initialSection as Section)
      ? (initialSection as Section)
      : "overview",
  );
  return (
    <div className="page-container demo-admin">
      <header className="surface-card demo-panel demo-admin-heading">
        <div>
          <span className="eyebrow">{t("Read-only demo")}</span>
          <h1>{t("Store manager preview")}</h1>
          <p>
            {t(
              "Separate fictional sample data. No admin credentials or real API connection.",
            )}
          </p>
        </div>
        <Link className="button outline" href="/">
          {t("View storefront")}
        </Link>
      </header>
      <div className="browser-demo-banner">
        <strong>{t("Read-only demo")}</strong>
        <span>
          {t(
            "Editing, saving, deletion, uploads, roles, finance, payments and refunds are disabled.",
          )}
        </span>
      </div>
      <nav className="demo-admin-tabs" aria-label={t("Admin preview sections")}>
        {sections.map((id) => (
          <button
            className={`button ${section === id ? "primary" : "outline"}`}
            key={id}
            onClick={() => setSection(id)}
            aria-pressed={section === id}
          >
            {t(id[0].toUpperCase() + id.slice(1))}
          </button>
        ))}
      </nav>
      {section === "overview" && (
        <>
          <div className="demo-metrics">
            {[
              ["Sample products", demoProducts.length],
              ["Sample orders", demoAdminOrders.length],
              [
                "Sample order value",
                money(
                  demoAdminOrders.reduce((sum, order) => sum + order.total, 0),
                ),
              ],
              ["Market", "USA / USD"],
            ].map(([label, value]) => (
              <article className="surface-card demo-panel" key={label}>
                <span>{t(String(label))}</span>
                <h2>{value}</h2>
              </article>
            ))}
          </div>
          <section className="surface-card demo-panel">
            <h2>{t("Sample delivery locations")}</h2>
            {demoAdminOrders.map((order) => (
              <p key={order.reference}>
                {order.customer.area} · {order.timeZone} ·{" "}
                {money(order.delivery)} {t("Delivery fee")}
              </p>
            ))}
            <p>
              {t(
                "Sales tax is not calculated. This is not a tax-compliant checkout.",
              )}
            </p>
          </section>
        </>
      )}
      {(section === "products" || section === "inventory") && (
        <section className="surface-card demo-panel">
          <h2>{t(section === "products" ? "Products" : "Inventory")}</h2>
          <div className="demo-table-scroll">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>{t("Product")}</th>
                  <th>{t("Pack size")}</th>
                  <th>{t("Price")}</th>
                  <th>{t("Sample stock")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {demoProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="demo-product-cell">
                        <ProductImage product={product} />
                        <span>
                          {t(product.name)}
                          <small>{product.id}</small>
                        </span>
                      </div>
                    </td>
                    <td>{t(product.unit)}</td>
                    <td>{money(product.price)}</td>
                    <td>{product.stock}</td>
                    <td>{t("Read-only demo")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {section === "orders" && (
        <section className="surface-card demo-panel">
          <h2>{t("Sample orders")}</h2>
          <div className="demo-table-scroll">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>{t("Reference")}</th>
                  <th>{t("Fictional customer")}</th>
                  <th>{t("Location / timezone")}</th>
                  <th>{t("Created")}</th>
                  <th>{t("Total")}</th>
                </tr>
              </thead>
              <tbody>
                {demoAdminOrders.map((order) => (
                  <tr key={order.reference}>
                    <td>
                      {order.reference}
                      <small>{t("Simulated order")}</small>
                    </td>
                    <td>
                      {order.customer.name}
                      <small>
                        {order.customer.street}
                        <br />
                        {order.customer.city}, {order.customer.state}{" "}
                        {order.customer.zip}
                        <br />
                        United States · {order.customer.phone}
                      </small>
                    </td>
                    <td>
                      {order.customer.area}
                      <small>{order.timeZone}</small>
                    </td>
                    <td>
                      {orderTime(order.createdAt, locale, order.timeZone)}
                    </td>
                    <td>{money(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
