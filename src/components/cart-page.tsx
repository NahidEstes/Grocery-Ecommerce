"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Leaf,
  LockKeyhole,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { cartTotals, FREE_DELIVERY_AT, money } from "@/lib/commerce";
import { useShop } from "./shop-provider";
import {
  Benefits,
  Breadcrumb,
  ProductCard,
  ProductImage,
  QuantityControl,
  SectionTitle,
} from "./ui";
import { CheckoutSteps } from "./order-ui";

export function CartPage() {
  const { t } = useLanguage();
  const {
    items,
    catalog,
    ready,
    setQuantity,
    notify,
    promoCode: promo,
    setPromoCode: setPromo,
    settings,
    area,
  } = useShop();
  const [promoInput, setPromoInput] = useState("");
  useEffect(() => {
    setPromoInput(promo);
  }, [promo]);
  const [promoError, setPromoError] = useState("");
  const totals = cartTotals(items, catalog, promo, settings, area);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const suggestions = catalog
    .filter(
      (p) =>
        !p.parentId &&
        p.active !== false &&
        p.stock > 0 &&
        !items.some((item) => item.productId === p.id),
    )
    .sort((a, b) => {
      const relevant = ["bread", "milk", "eggs"].some((id) =>
        items.some((i) => i.productId === id),
      )
        ? ["eggs", "milk", "bread", "banana"]
        : ["potato", "tomato", "carrot", "oil"];
      const rank = (id: string) =>
        relevant.includes(id) ? relevant.indexOf(id) : 99;
      return rank(a.id) - rank(b.id);
    })
    .slice(0, 3);
  function applyPromo(event: FormEvent) {
    event.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (settings.promos.some((p) => p.active && p.code === code)) {
      setPromo(code);
      setPromoError("");
      notify(t("{code} applied. A little extra goodness!", { code }));
    } else {
      setPromoError("This promo code is not available.");
    }
  }
  return (
    <div className="page-container cart-page">
      <Breadcrumb items={[{ label: "Shopping Cart" }]} />
      <div className="cart-heading">
        <div>
          <h1>
            {t("Shopping Cart")}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {t(
              count === 1
                ? "{count} item in your cart"
                : "{count} items in your cart",
              { count },
            )}
          </p>
        </div>
        <CheckoutSteps step={1} />
      </div>
      {!ready ? (
        <div className="loading-state">{t("Getting your basket ready…")}</div>
      ) : items.length === 0 ? (
        <div className="empty-state cart-empty">
          <div className="empty-basket">
            <ShoppingBag size={56} />
            <Leaf size={22} />
          </div>
          <span className="eyebrow">
            {t("GOOD THINGS START WITH A FRESH BASKET")}
          </span>
          <h2>{t("Your cart is waiting for something good.")}</h2>
          <p>
            {t(
              "Fresh favourites, everyday essentials and a little extra goodness.",
            )}
          </p>
          <Link href="/products" className="button primary">
            {t("Start shopping")}
            <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-layout">
            <section className="cart-table" aria-label={t("Cart items")}>
              <div className="cart-table-head">
                <span>{t("Product")}</span>
                <span>{t("Price")}</span>
                <span>{t("Quantity")}</span>
                <span>{t("Total")}</span>
                <span />
              </div>
              {items.map((item) => {
                const p = catalog.find(
                  (product) => product.id === item.productId,
                )!;
                return (
                  <div className="cart-row" key={p.id}>
                    <Link className="cart-product" href={`/products/${p.slug}`}>
                      <ProductImage product={p} />
                      <span>
                        <strong>{t(p.name)}</strong>
                        <small>{t(p.unit)}</small>
                      </span>
                    </Link>
                    <span className="cart-unit-price">{money(p.price)}</span>
                    <QuantityControl
                      compact
                      quantity={item.quantity}
                      max={p.stock}
                      label={p.name}
                      onChange={(quantity) => setQuantity(p.id, quantity)}
                    />
                    <strong className="cart-line-total">
                      {money(p.price * item.quantity)}
                    </strong>
                    <button
                      className="remove-item icon-button"
                      aria-label={t("Remove {name}", { name: t(p.name) })}
                      onClick={() => {
                        setQuantity(p.id, 0);
                        notify(`${p.name} removed from your cart`);
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
              <div className="free-delivery-progress">
                <Truck size={27} />
                <div>
                  <strong>
                    {totals.remaining > 0 ? (
                      <>
                        {t("Add ")}
                        {money(totals.remaining)}
                        {t(" more for free delivery")}
                      </>
                    ) : (
                      t("You’ve unlocked free delivery!")
                    )}
                  </strong>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(100, (totals.subtotal / settings.freeDeliveryAt) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <small>
                  {money(totals.subtotal)} / {money(settings.freeDeliveryAt)}
                </small>
              </div>
            </section>
            <aside className="order-summary">
              <h2>{t("Order Summary")}</h2>
              <dl className="totals-list">
                <div>
                  <dt>
                    {t("Subtotal (")}
                    {count}
                    {t(" items)")}
                  </dt>
                  <dd>{money(totals.subtotal)}</dd>
                </div>
                <div>
                  <dt>{t("Delivery fee")}</dt>
                  <dd>
                    {totals.delivery ? (
                      money(totals.delivery)
                    ) : (
                      <span className="free-label">{t("FREE")}</span>
                    )}
                  </dd>
                </div>
                {totals.discount > 0 && (
                  <div className="discount-line">
                    <dt>
                      {promo}
                      {t(" discount")}
                      <button
                        className="text-button"
                        onClick={() => {
                          setPromo("");
                          setPromoInput("");
                        }}
                      >
                        {t("Remove")}
                      </button>
                    </dt>
                    <dd>− {money(totals.discount)}</dd>
                  </div>
                )}
                <div className="grand-total">
                  <dt>{t("Total")}</dt>
                  <dd>{money(totals.total)}</dd>
                </div>
              </dl>
              <form className="promo-form" onSubmit={applyPromo}>
                <label htmlFor="promo-code">{t("Have a promo code?")}</label>
                <div>
                  <Tag size={17} />
                  <input
                    id="promo-code"
                    placeholder={t("Enter promo code")}
                    maxLength={20}
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    disabled={!!promo}
                  />
                  <button type="submit" disabled={!!promo}>
                    {promo ? <Check size={17} /> : t("Apply")}
                  </button>
                </div>
                <small
                  className={promoError ? "form-error" : ""}
                  role={promoError ? "alert" : undefined}
                >
                  {promoError
                    ? t(promoError)
                    : promo
                      ? t("{code} applied — enjoy your savings.", {
                          code: promo,
                        })
                      : settings.promos.some((p) => p.active)
                        ? t("Available code: {code}", {
                            code: settings.promos.find((p) => p.active)!.code,
                          })
                        : t("Enter a valid store promo code.")}
                </small>
              </form>
              <Link
                className="button primary checkout-button"
                href={
                  promo
                    ? `/checkout?promo=${encodeURIComponent(promo)}`
                    : "/checkout"
                }
              >
                {t("Proceed to checkout")}
                <ArrowRight size={19} />
              </Link>
              <div className="secure-payments">
                <span>
                  <LockKeyhole size={13} />
                  {t("Secure checkout")}
                </span>
                <div>
                  <span className="payment-bkash">bKash</span>
                  <span className="payment-visa">VISA</span>
                  <span className="payment-cash">
                    <CreditCard size={17} />
                    {t("Cash on delivery")}
                  </span>
                </div>
                <p>{t("No payment details stored on this device.")}</p>
              </div>
            </aside>
          </div>
          <Link className="continue-shopping" href="/products">
            <ArrowLeft size={17} />
            {t("Continue shopping")}
          </Link>
        </>
      )}
      <SectionTitle
        title={
          items.length
            ? "You might also need"
            : "A few favourites to get you started"
        }
        subtitle={t("The little things that make the everyday better.")}
        href="/products"
        linkText={t("See more products")}
      />
      <div className="product-grid cart-suggestions">
        {suggestions.map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>
      <Benefits />
    </div>
  );
}
