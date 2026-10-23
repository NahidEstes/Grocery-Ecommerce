"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ListChecks,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { useShopping } from "./shopping-provider";
import { useShop } from "./shop-provider";
import { AddSelection } from "./basket-selection";
import { money } from "@/lib/commerce";
import { formatDelivery } from "@/lib/orders";
import { ProductImage } from "./ui";

export function ActiveOrderBanner() {
  const { t, locale } = useLanguage();
  const { user } = useAccount(),
    { activeOrder: order, error, loading, refresh } = useShopping(),
    { ready } = useShop();
  if (!user || !ready || !order) return null;
  const pending = order.payment === "online" && order.paymentStatus !== "paid";
  const label = pending
    ? "Payment needs your attention"
    : order.status === "placed"
      ? "Your order is received"
      : order.status === "preparing"
        ? "Freshness is being packed"
        : "Your order is out for delivery";
  return (
    <section
      className="active-order-banner"
      aria-label={t("Your active order")}
    >
      <span className="active-order-icon">
        {order.status === "out-for-delivery" ? (
          <Truck size={22} />
        ) : (
          <Package size={22} />
        )}
      </span>
      <div>
        <span>
          {t(
            order.mode === "demo"
              ? "DEMO ORDER · NO DELIVERY SCHEDULED"
              : "YOUR CURRENT ORDER",
          )}
          {t(error ? " · STATUS MAY BE OUTDATED" : "")}
        </span>
        <strong>{t(label)}</strong>
        <small>
          #{order.reference} · {formatDelivery(order.deliverySelection, locale)}
        </small>
      </div>
      <Link href={`/orders/${order.reference}`}>
        {t(pending ? "View payment" : "View order")} <ArrowRight size={16} />
      </Link>
      <button
        disabled={loading}
        aria-label={t("Refresh active order")}
        className="icon-button"
        onClick={() => void refresh()}
      >
        <RefreshCw size={15} />
      </button>
    </section>
  );
}
export function HomeShoppingHub() {
  const { t, locale } = useLanguage();
  const { user } = useAccount(),
    { regular, lists, loading, error, refresh } = useShopping(),
    { catalog, ready } = useShop();
  if (!ready)
    return (
      <div className="personal-shopping-loading" role="status">
        {t("Getting your shopping space ready…")}
      </div>
    );
  if (!user)
    return (
      <section className="shopping-welcome-strip">
        <span className="round-icon">
          <ListChecks size={23} />
        </span>
        <div>
          <strong>{t("Your everyday, remembered.")}</strong>
          <p>
            {t("Save a shopping list and find your usual favourites faster.")}
          </p>
        </div>
        <Link href="/account">
          {t("Make yourself at home ")}
          <ArrowRight size={16} />
        </Link>
      </section>
    );
  if (loading && !regular.length && !lists.length)
    return (
      <div className="personal-shopping-loading" role="status">
        {t("Finding your everyday favourites…")}
      </div>
    );
  return (
    <section className="home-shopping-hub">
      <div className="personal-shelf-heading">
        <div>
          <span className="eyebrow">
            <RefreshCw size={13} />
            {t(" A FAMILIAR KIND OF FRESH")}
          </span>
          <h2>{t("Your everyday favourites")}</h2>
          <p>
            {t("From your past orders. Today’s prices, ready for your basket.")}
          </p>
        </div>
        <Link href="/lists">
          <ListChecks size={16} />
          {t(" My lists ")}
          <ArrowRight size={14} />
        </Link>
      </div>
      {error && (
        <div className="personal-shopping-error">
          <p>{t(error)}</p>
          <button className="text-button" onClick={() => void refresh()}>
            {t("Try again")}
          </button>
        </div>
      )}
      {regular.length ? (
        <>
          <div className="regular-purchase-grid">
            {regular.slice(0, 4).map((item) => {
              const product = catalog.find((p) => p.id === item.productId);
              return (
                <article key={item.productId}>
                  {product ? (
                    <Link
                      href={`/products/${product.slug}`}
                      aria-label={t("View {name}", { name: t(product.name) })}
                    >
                      <ProductImage product={product} />
                    </Link>
                  ) : (
                    <span className="regular-missing">
                      <ShoppingBag size={30} />
                    </span>
                  )}
                  <div>
                    <strong>{t(product?.name || item.name)}</strong>
                    <small>{t(product?.unit || item.unit)}</small>
                    <span className="regular-price">
                      {product ? money(product.price) : "Unavailable"}{" "}
                      <small>{t("per pack")}</small>
                    </span>
                  </div>
                  {product && product.stock > 0 ? (
                    <AddSelection
                      items={[{ productId: product.id, quantity: 1 }]}
                      label="Add a pack"
                      className="button outline small"
                    />
                  ) : (
                    <span className="list-stock-note">
                      {t("Currently unavailable")}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
          <div className="regular-shelf-footer">
            <span>
              <Check size={14} />
              {t(" Based on your own order history")}
            </span>
            <Link href="/orders">
              {t("All past orders ")}
              <ArrowRight size={14} />
            </Link>
          </div>
        </>
      ) : (
        !error && (
          <div className="regular-first-order">
            <ShoppingBag size={27} />
            <p>
              {t(
                "Your usuals will appear after your first order. Start a list to plan your next shop.",
              )}
            </p>
          </div>
        )
      )}
      <div className="home-list-shortcuts">
        {lists
          .filter((l) => !l.archived)
          .slice(0, 2)
          .map((list) => (
            <Link href="/lists" key={list.id}>
              <ListChecks size={18} />
              <span>
                <strong>{list.name}</strong>
                <small>
                  {list.items.length}
                  {t(" saved products")}
                </small>
              </span>
              <ArrowRight size={15} />
            </Link>
          ))}
        <Link href="/lists" className="new-list-shortcut">
          <ListChecks size={18} />
          <span>
            <strong>{t("Plan your next market day")}</strong>
            <small>{t("Create a personal shopping list")}</small>
          </span>
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
