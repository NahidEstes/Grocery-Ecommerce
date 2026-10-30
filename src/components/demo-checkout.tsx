"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useShop } from "./shop-provider";
import { useLanguage } from "./language-provider";
import { useStoreFormat } from "./store-format";
import { CheckoutSteps, OrderTotals } from "./order-ui";
import { ProductImage } from "./ui";
import { cartTotals } from "@/lib/commerce";
import { demoCities, demoCity } from "@/lib/browser-demo/config";
import { demoCustomer } from "@/lib/browser-demo/data";
import {
  demoDays,
  makeDemoOrder,
  storeDemoOrder,
  type DemoCustomer,
} from "@/lib/browser-demo/orders";
import type { DeliverySelection } from "@/lib/orders";

export function DemoCheckout({ promo }: { promo: string }) {
  const { t } = useLanguage(),
    { money } = useStoreFormat();
  const {
    items,
    catalog,
    ready,
    area,
    setArea,
    settings,
    promoCode,
    setPromoCode,
    clearCart,
  } = useShop();
  const router = useRouter(),
    placing = useRef(false);
  const [customer, setCustomer] = useState<DemoCustomer>(() =>
    demoCustomer("New York, NY"),
  );
  const [selection, setSelection] = useState<DeliverySelection | null>(null);
  const [days, setDays] = useState<ReturnType<typeof demoDays>>([]);
  const [agreed, setAgreed] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (ready && promo) setPromoCode(promo);
  }, [ready, promo, setPromoCode]);
  useEffect(() => {
    setCustomer(demoCustomer(area));
    setAgreed(false);
    const refresh = () => {
      const next = demoDays(area);
      setDays(next);
      setSelection((previous) =>
        previous &&
        next.some(
          (day) =>
            day.date === previous.date &&
            day.slots.some((slot) => slot.id === previous.slot),
        )
          ? previous
          : (() => {
              const first = next.find((day) => day.slots.length);
              return first
                ? { date: first.date, slot: first.slots[0].id }
                : null;
            })(),
      );
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [area]);
  useEffect(() => {
    const reset = () => {
      setCustomer(demoCustomer("New York, NY"));
      setAgreed(false);
      setError("");
    };
    window.addEventListener("freshcart-demo-reset", reset);
    return () => window.removeEventListener("freshcart-demo-reset", reset);
  }, []);
  const totals = cartTotals(items, catalog, promoCode, settings, area);
  useEffect(() => setAgreed(false), [totals.total]);
  function field(key: keyof DemoCustomer, value: string) {
    setCustomer((current) => ({ ...current, [key]: value }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (placing.current || !ready || !agreed || !selection) return;
    placing.current = true;
    setError("");
    try {
      const receipt = makeDemoOrder(
        items,
        area,
        promoCode,
        customer,
        selection,
      );
      storeDemoOrder(receipt);
      clearCart();
      router.push(`/orders/${receipt.reference}`);
    } catch (error) {
      placing.current = false;
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create demo receipt.",
      );
    }
  }
  if (!ready)
    return (
      <div className="page-container loading-state">
        {t("Getting your basket ready…")}
      </div>
    );
  if (!items.length)
    return (
      <div className="page-container empty-state">
        <h1>{t("Your cart is waiting for something good.")}</h1>
        <Link className="button primary" href="/products">
          {t("Start shopping")}
        </Link>
      </div>
    );
  return (
    <div className="page-container">
      <div className="cart-heading">
        <h1>{t("Simulated checkout")}</h1>
        <CheckoutSteps step={2} />
      </div>
      <p className="demo-store-note">
        Demo only — no real payment or delivery.
      </p>
      <p>
        {t(
          "Sales tax is not calculated. This is not a tax-compliant checkout.",
        )}
      </p>
      <div className="demo-checkout-grid">
        <form
          className="surface-card checkout-form demo-panel"
          onSubmit={submit}
        >
          <h2>{t("Fictional customer")}</h2>
          <p>
            {t(
              "Use these sample details. No personal information is required or sent.",
            )}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => setCustomer(demoCustomer(area))}
          >
            {t("Use sample customer")}
          </button>
          <div className="form-grid">
            <label>
              {t("Full name")}
              <input
                name="name"
                value={customer.name}
                onChange={(e) => field("name", e.target.value)}
                minLength={2}
                maxLength={80}
                required
                autoComplete="off"
              />
            </label>
            <label>
              {t("Phone number")}
              <input
                name="phone"
                type="tel"
                value={customer.phone}
                onChange={(e) => field("phone", e.target.value)}
                placeholder="+1 (202) 555-0142"
                required
                autoComplete="off"
              />
            </label>
          </div>
          <label>
            {t("Street address")}
            <input
              name="street"
              value={customer.street}
              onChange={(e) => field("street", e.target.value)}
              minLength={5}
              maxLength={200}
              required
              autoComplete="off"
            />
          </label>
          <div className="form-grid">
            <label>
              {t("City")}
              <select
                name="city"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                {demoCities.map((city) => (
                  <option key={city.name}>{city.name}</option>
                ))}
              </select>
            </label>
            <label>
              {t("State")}
              <input name="state" value={demoCity(area).state} readOnly />
            </label>
            <label>
              {t("ZIP code")}
              <input
                name="zip"
                value={customer.zip}
                onChange={(e) => field("zip", e.target.value)}
                pattern="[0-9]{5}(-[0-9]{4})?"
                required
              />
            </label>
            <label>
              {t("Country")}
              <input value="United States" readOnly />
            </label>
          </div>
          <h2>{t("Delivery slot")}</h2>
          <p>
            {settings.profile.timeZone} · {t("Sample delivery schedule only.")}
          </p>
          <div className="demo-slots">
            {days
              .filter((day) => day.slots.length)
              .map((day) => (
                <fieldset key={day.date}>
                  <legend>
                    {t(day.label)} · {day.short}
                  </legend>
                  {day.slots.map((slot) => (
                    <label key={slot.id}>
                      <input
                        type="radio"
                        name="slot"
                        value={`${day.date}/${slot.id}`}
                        checked={
                          selection?.date === day.date &&
                          selection.slot === slot.id
                        }
                        onChange={() =>
                          setSelection({ date: day.date, slot: slot.id })
                        }
                      />
                      {t(slot.label)}
                    </label>
                  ))}
                </fieldset>
              ))}
          </div>
          <p>
            {t("Payment simulation only. No card details, gateway or email.")}
          </p>
          <label className="demo-agreement">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            {t("I understand this creates a demo receipt only.")}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={!selection || !agreed}
          >
            {t("Place demo order")} · {money(totals.total)}
          </button>
        </form>
        <aside className="surface-card demo-panel">
          <h2>{t("Order summary")}</h2>
          {items.map((item) => {
            const product = catalog.find(
              (product) => product.id === item.productId,
            )!;
            return (
              <div className="demo-summary-item" key={product.id}>
                <ProductImage product={product} />
                <div>
                  <strong>{t(product.name)}</strong>
                  <p>
                    {t(product.unit)} × {item.quantity}
                  </p>
                </div>
                <span>{money(product.price * item.quantity)}</span>
              </div>
            );
          })}
          <p>
            {area} · {settings.profile.timeZone}
          </p>
          <p>
            {t("Promo code")}: {promoCode || "—"}
          </p>
          <OrderTotals order={totals} />
          <Link href="/cart">{t("Edit cart")}</Link>
        </aside>
      </div>
    </div>
  );
}
