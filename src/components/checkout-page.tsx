"use client";
import { useStoreFormat } from "./store-format";
import { useLanguage } from "./language-provider";
import { localeTag } from "@/lib/i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  CreditCard,
  Home,
  MapPin,
  Pencil,
  PlusCircle,
  Radio,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { cartTotals } from "@/lib/commerce";
import {
  deliveryDays,
  deliverySlots,
  isValidDelivery,
  type SavedAddress,
  type DeliverySelection,
} from "@/lib/orders";
import {
  readAddresses,
  saveAddresses,
  rememberOrder,
} from "@/lib/order-browser";
import { useShop } from "./shop-provider";
import { useAccount } from "./account-provider";
import { api } from "@/lib/client-api";
import type { Account } from "@/lib/storefront";
import type { Order } from "@/lib/orders";
import {
  readCheckoutAttempt,
  saveCheckoutAttempt,
  forgetCheckoutAttempt,
  prepareCheckoutAttempt,
  type CheckoutAttempt,
} from "@/lib/checkout-attempt";
import { AddressForm } from "./address-form";
import { Breadcrumb, ProductImage } from "./ui";
import {
  CheckoutSteps,
  OrderTotals,
  PolicyLinks,
  SecureCheckout,
} from "./order-ui";

export function CheckoutPage({ promo: initialPromo }: { promo: string }) {
  const { money } = useStoreFormat();
  const { t, locale } = useLanguage();
  const {
    items,
    catalog,
    ready,
    area,
    setArea,
    setQuantity,
    notify,
    promoCode,
    setPromoCode,
    settings,
    payments,
    refreshCatalog,
  } = useShop();
  const { user, setUser, ready: accountReady } = useAccount();
  const [payment, setPayment] = useState<"cash-on-delivery" | "online">(
    "cash-on-delivery",
  );
  const availableDays = () =>
    deliveryDays(new Date(), settings.profile.timeZone).map((day) => ({
      ...day,
      slots: day.slots.filter((s) =>
        settings.slots.some((v) => v.enabled && v.id === s.id),
      ),
    }));
  const router = useRouter();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<SavedAddress | null | undefined>(
    undefined,
  );
  const [days, setDays] = useState<ReturnType<typeof deliveryDays>>([]);
  const [delivery, setDelivery] = useState<DeliverySelection | null>(null);
  const [instructions, setInstructions] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const promo = initialPromo || promoCode;
  useEffect(() => {
    if (ready && !submitted && initialPromo && initialPromo !== promoCode)
      setPromoCode(initialPromo);
  }, [ready, submitted, initialPromo, promoCode, setPromoCode]);
  const request = useRef<CheckoutAttempt | null>(null);
  const owner = user?.id || "guest",
    ownerRef = useRef(owner),
    cartRef = useRef(items),
    recoveredFor = useRef("");
  ownerRef.current = owner;
  cartRef.current = items;
  const [recovering, setRecovering] = useState(true);
  type Confirmation = {
    reference: string;
    total: number;
    createdAt: string;
    paymentUrl?: string;
    paymentError?: string;
    order?: Order;
  };
  function finish(result: Confirmation, attempt: CheckoutAttempt) {
    if (ownerRef.current !== attempt.owner) return;
    rememberOrder({
      reference: result.reference,
      accessToken: attempt.accessToken,
      total: result.total,
      createdAt: result.createdAt,
    });
    // Preserve groceries added while the response was in flight.
    const purchased =
      result.order?.items ||
      (JSON.parse(attempt.payload).items as {
        productId: string;
        quantity: number;
      }[]);
    for (const item of cartRef.current) {
      const quantity = purchased
        .filter((p) => p.productId === item.productId)
        .reduce((n, p) => n + p.quantity, 0);
      if (quantity)
        setQuantity(item.productId, Math.max(0, item.quantity - quantity));
    }
    forgetCheckoutAttempt(attempt.owner);
    request.current = null;
    setSubmitted(true);
    try {
      sessionStorage.removeItem("freshcart-checkout");
    } catch {}
    if (result.paymentUrl) {
      window.location.assign(result.paymentUrl);
      return;
    }
    if (result.paymentError) notify(result.paymentError);
    router.push(`/orders/${result.reference}`);
  }
  async function recover(attempt: CheckoutAttempt) {
    try {
      const result = await api<Confirmation>(
        `/checkout-attempt/${attempt.requestId}`,
        { headers: { Authorization: `Bearer ${attempt.accessToken}` } },
      );
      finish(result, attempt);
      return true;
    } catch (e) {
      if ((e as { status?: number }).status === 404) return false;
      throw e;
    }
  }
  useEffect(() => {
    if (!ready || !accountReady || recoveredFor.current === owner) return;
    recoveredFor.current = owner;
    const attempt = readCheckoutAttempt(owner);
    request.current = attempt;
    if (!attempt) {
      setRecovering(false);
      return;
    }
    setRecovering(true);
    void recover(attempt)
      .catch(() =>
        setError(
          "An earlier checkout could not be checked. Keep this browser open and retry; your attempt is saved.",
        ),
      )
      .finally(() => setRecovering(false));
  }, [ready, accountReady, owner]);
  const address = addresses.find((a) => a.id === selectedId);
  const totals = cartTotals(
    items,
    catalog,
    promo,
    settings,
    address?.area || area,
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => setAgreed(false), [totals.total]);
  useEffect(() => {
    const saved = readAddresses();
    setAddresses(saved);
    let previous: {
      selectedId?: string;
      delivery?: DeliverySelection;
      instructions?: string;
    } = {};
    try {
      previous =
        JSON.parse(sessionStorage.getItem("freshcart-checkout") || "{}") || {};
    } catch {
      /* Ignore malformed or blocked storage. */
    }
    const selected =
      saved.find((a) => a.id === previous.selectedId) || saved[0];
    setSelectedId(selected?.id || "");
    if (selected) setArea(selected.area);
    const available = deliveryDays();
    setDays(available);
    const first = available.find((day) => day.slots.length);
    if (previous.delivery && isValidDelivery(previous.delivery))
      setDelivery(previous.delivery);
    else if (first) setDelivery({ date: first.date, slot: first.slots[0].id });
    if (typeof previous.instructions === "string")
      setInstructions(previous.instructions.slice(0, 200));
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) =>
        setMode(data.mode === "production" ? "production" : "demo"),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!accountReady) return;
    const saved = user ? user.addresses : readAddresses();
    setAddresses(saved);
    setSelectedId((previous) =>
      saved.some((a) => a.id === previous) ? previous : saved[0]?.id || "",
    );
  }, [accountReady, user?.id]);
  useEffect(() => {
    const available = availableDays();
    setDays(available);
    setDelivery((previous) =>
      previous &&
      available.some(
        (d) =>
          d.date === previous.date &&
          d.slots.some((s) => s.id === previous.slot),
      )
        ? previous
        : available.find((d) => d.slots.length)
          ? {
              date: available.find((d) => d.slots.length)!.date,
              slot: available.find((d) => d.slots.length)!.slots[0].id,
            }
          : null,
    );
  }, [settings]);
  useEffect(() => {
    if (!days.length || submitted) return;
    try {
      sessionStorage.setItem(
        "freshcart-checkout",
        JSON.stringify({ selectedId, delivery, instructions }),
      );
    } catch {
      /* Checkout also works without session storage. */
    }
  }, [selectedId, delivery, instructions, days.length, submitted]);
  // Refresh slot availability while a checkout remains open.
  useEffect(() => {
    const timer = setInterval(() => setDays(availableDays()), 60_000);
    return () => clearInterval(timer);
  }, [settings]);
  async function syncAddresses(next: SavedAddress[]) {
    if (user) {
      const data = await api<{ user: Account }>("/me", {
        method: "PATCH",
        body: JSON.stringify({ name: user.name, addresses: next }),
      });
      setUser(data.user);
    } else saveAddresses(next);
  }
  async function persistAddress(value: SavedAddress) {
    const next = addresses.some((a) => a.id === value.id)
      ? addresses.map((a) => (a.id === value.id ? value : a))
      : [...addresses, value];
    if (next.length > 8) {
      throw new Error(
        "You can save up to eight addresses. Remove one before adding another.",
      );
    }
    await syncAddresses(next);
    setAddresses(next);
    setSelectedId(value.id);
    setArea(value.area);
    setEditing(undefined);
  }
  async function removeAddress(id: string) {
    const next = addresses.filter((a) => a.id !== id);
    try {
      await syncAddresses(next);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setAddresses(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || "");
      if (next[0]) setArea(next[0].area);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || submitted) return;
    setError("");
    if (!address) {
      setError("Add and select a delivery address to continue.");
      return;
    }
    if (
      !delivery ||
      !isValidDelivery(delivery, new Date(), settings.profile.timeZone) ||
      !settings.slots.some((s) => s.enabled && s.id === delivery.slot)
    ) {
      setDays(availableDays());
      setError("Please choose an available delivery date and time.");
      return;
    }
    if (!agreed) {
      setError(
        "Please review the delivery and privacy information before continuing.",
      );
      return;
    }
    if (!items.length) {
      setError("Your cart is empty. Add groceries before checking out.");
      return;
    }
    const payload = JSON.stringify({
      customer: {
        name: address.name,
        phone: address.phone,
        address: address.address,
        area: address.area,
      },
      items,
      promo,
      deliverySelection: delivery,
      instructions,
      payment,
      expectedTotal: totals.total,
      acceptedTerms: true,
    });
    setLoading(true);
    try {
      const previous = request.current || readCheckoutAttempt(owner);
      if (previous && (await recover(previous))) return;
      const credentials = prepareCheckoutAttempt(owner, payload, previous);
      try {
        saveCheckoutAttempt(credentials);
      } catch {
        throw new Error(
          "Allow browser storage before placing an order so an interrupted checkout can be recovered.",
        );
      }
      request.current = credentials;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...JSON.parse(payload),
          requestId: credentials.requestId,
          accessToken: credentials.accessToken,
        }),
      });
      const result = await response.json().catch(() => {
        throw new Error(
          "FreshCart is temporarily unavailable. Your basket has been kept.",
        );
      });
      if (!response.ok) {
        if (response.status === 409 && (await recover(credentials))) return;
        if (response.status === 409) await refreshCatalog().catch(() => {});
        throw new Error(
          result.message || "We couldn’t save your order. Please try again.",
        );
      }
      finish(result, credentials);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t connect. Your basket is safe; please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  if (!ready || !accountReady || !days.length || recovering)
    return (
      <div className="page-container loading-state">
        {t("Getting your checkout ready…")}
      </div>
    );
  if (!items.length && !submitted)
    return (
      <div className="page-container empty-state">
        <ShoppingBag size={52} />
        <h1>{t("Your basket is empty.")}</h1>
        <p>{t("Add a few fresh favourites to continue to checkout.")}</p>
        {error && <p role="alert">{t(error)}</p>}
        <Link className="button primary" href="/products">
          {t("Start shopping")}
          <ArrowRight size={17} />
        </Link>
      </div>
    );
  if (submitted)
    return (
      <div className="page-container loading-state">
        {t("Opening your order confirmation…")}
      </div>
    );
  return (
    <div className="page-container checkout-page">
      <Breadcrumb
        items={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]}
      />
      <div className="checkout-page-heading">
        <h1>{t("Checkout")}</h1>
        <CheckoutSteps step={2} />
      </div>
      <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-sections">
          <section className="checkout-section">
            <div className="checkout-section-title">
              <span>1</span>
              <h2>{t("Delivery address")}</h2>
            </div>
            <div className="checkout-addresses">
              {addresses.map((value) => (
                <div
                  className={`address-card ${value.id === selectedId ? "selected" : ""}`}
                  key={value.id}
                >
                  <label>
                    <input
                      type="radio"
                      name="delivery-address"
                      value={value.id}
                      checked={value.id === selectedId}
                      onChange={() => {
                        setSelectedId(value.id);
                        setArea(value.area);
                      }}
                    />
                    <Home size={29} />
                    <span>
                      <strong>{t(value.label)}</strong>
                      <span>
                        {value.address}, {value.area}
                        {", "}
                        {settings.profile.city}
                      </span>
                      <small>
                        {value.name} · {value.phone}
                      </small>
                    </span>
                  </label>
                  <div className="address-actions">
                    <button
                      type="button"
                      onClick={() => setEditing(value)}
                      aria-label={`Edit ${value.label} address`}
                    >
                      <Pencil size={15} />
                      <span>{t("Edit")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAddress(value.id)}
                      aria-label={`Remove ${value.label} address`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="add-address"
              onClick={() => setEditing(null)}
              disabled={addresses.length >= 8}
            >
              <PlusCircle size={19} />
              {t("Add new address")}
            </button>
          </section>
          <section className="checkout-section">
            <div className="checkout-section-title">
              <span>2</span>
              <div>
                <h2>{t("Delivery slot")}</h2>
                <p>{t("Choose your preferred delivery time")}</p>
              </div>
            </div>
            <div className="delivery-day-grid">
              {days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  disabled={!day.slots.length}
                  aria-pressed={delivery?.date === day.date}
                  className={delivery?.date === day.date ? "selected" : ""}
                  onClick={() =>
                    setDelivery({
                      date: day.date,
                      slot: day.slots.some((slot) => slot.id === delivery?.slot)
                        ? delivery!.slot
                        : day.slots[0].id,
                    })
                  }
                >
                  <CalendarDays size={23} />
                  <span>
                    <strong>{t(day.label)}</strong>
                    <small>
                      {new Date(`${day.date}T12:00:00Z`).toLocaleDateString(
                        localeTag(locale),
                        { month: "short", day: "numeric", timeZone: "UTC" },
                      )}
                      {!day.slots.length && " · Closed"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className="delivery-slot-grid">
              {deliverySlots.map((slot) => {
                const available = days
                  .find((day) => day.date === delivery?.date)
                  ?.slots.some((value) => value.id === slot.id);
                return (
                  <label
                    key={slot.id}
                    className={`${delivery?.slot === slot.id && available ? "selected" : ""} ${!available ? "unavailable" : ""}`}
                  >
                    <input
                      type="radio"
                      name="delivery-slot"
                      checked={delivery?.slot === slot.id && !!available}
                      disabled={!available}
                      onChange={() =>
                        setDelivery({ date: delivery!.date, slot: slot.id })
                      }
                    />
                    <span>
                      <strong>{t(slot.label)}</strong>
                      <small>
                        {t(available ? "Standard delivery" : "Unavailable")}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="delivery-time-note">
              {settings.profile.timeZone} ·{" "}
              {t("Slots close one hour before they start.")}
            </p>
          </section>
          <section className="checkout-section">
            <div className="checkout-section-title">
              <span>3</span>
              <h2>{t("Payment method")}</h2>
            </div>
            <div className="payment-method-grid">
              <label
                className={payment === "cash-on-delivery" ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="payment"
                  value="cash-on-delivery"
                  checked={payment === "cash-on-delivery"}
                  onChange={() => setPayment("cash-on-delivery")}
                />
                <Banknote size={31} />
                <span>
                  <strong>{t("Cash on delivery")}</strong>
                  <small>{t("Pay when you receive")}</small>
                </span>
              </label>
              <label
                className={
                  !payments.enabled || !user
                    ? "unavailable"
                    : payment === "online"
                      ? "selected"
                      : ""
                }
              >
                <input
                  type="radio"
                  name="payment"
                  value="online"
                  disabled={!payments.enabled || !user}
                  checked={payment === "online"}
                  onChange={() => setPayment("online")}
                />
                <span className="bkash-symbol">bK</span>
                <span>
                  <strong>{t("bKash / Card")}</strong>
                  <small>
                    {t(
                      payments.enabled
                        ? payments.sandbox
                          ? "Gateway sandbox"
                          : "Secure gateway"
                        : "Not configured",
                    )}
                  </small>
                </span>
              </label>
            </div>
            <p className="payment-availability">
              {t(
                payments.enabled
                  ? user
                    ? "You will choose bKash or card on the payment gateway."
                    : "Sign in to use online payment."
                  : "Online payment is unavailable until the store configures its gateway.",
              )}
            </p>
            <label className="instructions-label">
              {t("Delivery instructions ")}
              <span>{t("(optional)")}</span>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                maxLength={200}
                rows={3}
                placeholder={t(
                  "E.g. Call on arrival, apartment number or any specific instructions…",
                )}
              />
              <small>{instructions.length}/200</small>
            </label>
          </section>
        </div>
        <aside className="checkout-summary">
          <div className="checkout-summary-heading">
            <h2>{t("Order Summary")}</h2>
            <Link href="/cart">{t("Edit cart")}</Link>
          </div>
          <div className="checkout-items">
            {items.map((item) => {
              const product = catalog.find((p) => p.id === item.productId)!;
              return (
                <div className="checkout-item" key={product.id}>
                  <ProductImage product={product} />
                  <div>
                    <Link href={`/products/${product.slug}`}>
                      <strong>{t(product.name)}</strong>
                    </Link>
                    <small>{t(product.unit)}</small>
                  </div>
                  <label>
                    <span className="sr-only">
                      {t("Quantity for ")}
                      {t(product.name)}
                    </span>
                    <select
                      value={item.quantity}
                      onChange={(event) =>
                        setQuantity(product.id, Number(event.target.value))
                      }
                    >
                      {Array.from({ length: product.stock }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <strong className="checkout-item-price">
                    {money(product.price * item.quantity)}
                  </strong>
                </div>
              );
            })}
          </div>
          <OrderTotals order={totals} />
          {promo && (
            <p className="checkout-promo">
              <Check size={14} />
              {promo}
              {t(" applied")}
            </p>
          )}
          <label className="consent-line">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              {t("I’ve reviewed the ")}
              <PolicyLinks />.
            </span>
          </label>
          {error && (
            <p className="form-error checkout-error" role="alert">
              {t(error)}
            </p>
          )}
          <button
            className="button primary place-order"
            type="submit"
            disabled={loading || submitted}
          >
            {loading
              ? t("Saving your order…")
              : `${t(payment === "online" ? "Continue to payment" : mode === "demo" ? "Place demo order" : "Place order")} · ${money(totals.total)}`}
            <ArrowRight size={19} />
          </button>
          {mode === "demo" && (
            <p className="checkout-demo-note">
              {t(
                "Demo order: saved for testing. No payment is collected and no delivery is scheduled.",
              )}
            </p>
          )}
          <SecureCheckout />
        </aside>
      </form>
      {editing !== undefined && (
        <AddressForm
          initial={editing || undefined}
          area={area}
          onSave={persistAddress}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
