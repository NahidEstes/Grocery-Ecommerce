"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
import { useStoreFormat } from "./store-format";
import { OrderTotals, CheckoutSteps } from "./order-ui";
import { formatDelivery } from "@/lib/orders";
import { readDemoOrders, type DemoReceipt } from "@/lib/browser-demo/orders";

export function DemoOrders({ reference }: { reference?: string }) {
  const { t, locale } = useLanguage(),
    { money, orderTime } = useStoreFormat();
  const [orders, setOrders] = useState<DemoReceipt[]>([]),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => {
      setOrders(readDemoOrders());
      setReady(true);
    };
    refresh();
    window.addEventListener("freshcart-demo-reset", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("freshcart-demo-reset", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [reference]);
  const order = reference
    ? orders.find((order) => order.reference === reference)
    : null;
  return (
    <div className="page-container">
      <div className="cart-heading">
        <h1>{t(reference ? "Demo order confirmation" : "Demo receipts")}</h1>
        {reference && <CheckoutSteps step={3} />}
      </div>
      <p className="demo-store-note">
        Demo only — no real payment or delivery.
      </p>
      <p>
        {t(
          "Demo orders stay in this browser only. No payment was taken, no email was sent and no delivery was arranged.",
        )}
      </p>
      {!ready ? (
        <p>{t("Loading…")}</p>
      ) : reference ? (
        order ? (
          <div className="demo-checkout-grid">
            <section className="surface-card demo-panel">
              <span className="eyebrow">{t("Simulated order")}</span>
              <h2 className="demo-reference">{order.reference}</h2>
              <p>
                {orderTime(order.createdAt, locale, order.timeZone)} ·{" "}
                {order.timeZone}
              </p>
              <h3>{t("Fictional customer")}</h3>
              <p>
                {order.customer.name} · {order.customer.phone}
              </p>
              <p>
                {order.customer.street}
                <br />
                {order.customer.city}, {order.customer.state}{" "}
                {order.customer.zip}
                <br />
                United States
              </p>
              <p>
                {formatDelivery(order.deliverySelection, locale)} ·{" "}
                {order.timeZone}
              </p>
              <p>
                {t(
                  "Sales tax is not calculated. This is not a tax-compliant checkout.",
                )}
              </p>
              <Link className="button primary" href="/products">
                {t("Continue shopping")}
              </Link>
              <Link className="button outline" href="/orders">
                {t("Demo receipts")}
              </Link>
            </section>
            <section className="surface-card demo-panel">
              <h2>{t("Order summary")}</h2>
              {order.items.map((item) => (
                <div className="demo-receipt-line" key={item.productId}>
                  <span>
                    {t(item.name)} · {t(item.unit)} × {item.quantity}
                  </span>
                  <strong>
                    {money(item.price * item.quantity, order.currency)}
                  </strong>
                </div>
              ))}
              <p>
                {t("Promo code")}: {order.promo || "—"}
              </p>
              <OrderTotals order={order} />
            </section>
          </div>
        ) : (
          <section className="empty-state">
            <h2>{t("Demo receipt not found in this browser.")}</h2>
            <p>
              {t("It may have been reset, or browser storage was unavailable.")}
            </p>
          </section>
        )
      ) : orders.length ? (
        <div className="order-history-list">
          {orders.map((order) => (
            <article className="surface-card demo-panel" key={order.reference}>
              <h2 className="demo-reference">{order.reference}</h2>
              <p>
                {order.customer.area} · {order.timeZone}
              </p>
              <p>
                {orderTime(order.createdAt, locale, order.timeZone)} ·{" "}
                {money(order.total, order.currency)}
              </p>
              <Link href={`/orders/${order.reference}`}>
                {t("View demo receipt")}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p>{t("No demo receipts yet.")}</p>
      )}
    </div>
  );
}
