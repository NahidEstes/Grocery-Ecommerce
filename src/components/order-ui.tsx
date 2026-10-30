"use client";
import { useStoreFormat } from "./store-format";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { Check, CircleHelp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import type { Order } from "@/lib/orders";
import { Modal, ProductImage } from "./ui";
import type { Product } from "@/lib/catalog";
import { useShop } from "./shop-provider";

export function CheckoutSteps({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useLanguage();
  return (
    <nav
      className="checkout-steps flow-steps"
      aria-label={t("Checkout progress")}
    >
      {["Cart", "Checkout", "Confirmation"].map((label, index) => (
        <span
          key={label}
          className={
            index + 1 === step ? "active" : index + 1 < step ? "completed" : ""
          }
          aria-current={index + 1 === step ? "step" : undefined}
        >
          <i>{index + 1 < step ? <Check size={16} /> : index + 1}</i>
          {index === 0 ? <Link href="/cart">{t(label)}</Link> : t(label)}
        </span>
      ))}
    </nav>
  );
}
export function OrderTotals({
  order,
}: {
  order: Pick<Order, "subtotal" | "delivery" | "discount" | "total">;
}) {
  const { money } = useStoreFormat();
  const { t } = useLanguage();
  return (
    <dl className="totals-list checkout-totals">
      <div>
        <dt>{t("Subtotal")}</dt>
        <dd>{money(order.subtotal)}</dd>
      </div>
      <div>
        <dt>{t("Delivery fee")}</dt>
        <dd>
          {order.delivery ? (
            money(order.delivery)
          ) : (
            <span className="free-label">{t("FREE")}</span>
          )}
        </dd>
      </div>
      {order.discount > 0 && (
        <div className="discount-line">
          <dt>{t("Promo discount")}</dt>
          <dd>− {money(order.discount)}</dd>
        </div>
      )}
      <div className="grand-total">
        <dt>{t("Total")}</dt>
        <dd>{money(order.total)}</dd>
      </div>
    </dl>
  );
}
export function SnapshotPhoto({ item }: { item: Order["items"][number] }) {
  const product = {
    ...item,
    id: item.productId,
    slug: "",
    category: "",
    stock: 0,
    rating: 0,
    description: "",
  } as Product;
  return <ProductImage product={product} />;
}
export function SecureCheckout() {
  const { t } = useLanguage();
  return (
    <div className="checkout-reassurance">
      <ShieldCheck size={33} />
      <div>
        <strong>{t("Secure checkout")}</strong>
        <small>{t("Your details are used to save your order.")}</small>
      </div>
    </div>
  );
}
export function PolicyLinks({ kind = "terms" }: { kind?: "terms" | "help" }) {
  const { t } = useLanguage();
  const { settings } = useShop();
  const [open, setOpen] = useState<"terms" | "privacy" | "help" | null>(null);
  return (
    <>
      {kind === "terms" ? (
        <>
          <button
            type="button"
            className="policy-link"
            onClick={() => setOpen("terms")}
          >
            {t("Terms of Service")}
          </button>
          <span>{t(" and ")}</span>
          <button
            type="button"
            className="policy-link"
            onClick={() => setOpen("privacy")}
          >
            {t("Privacy Policy")}
          </button>
        </>
      ) : (
        <button className="order-help" onClick={() => setOpen("help")}>
          <CircleHelp size={18} />
          {t("Need help? ")}
          <span>{t("Order help")}</span>
        </button>
      )}
      {open &&
        createPortal(
          <Modal
            title={
              open === "privacy"
                ? "Privacy information"
                : open === "help"
                  ? "Help with your order"
                  : "Delivery & order information"
            }
            onClose={() => setOpen(null)}
          >
            <div className="policy-content">
              <p style={{ whiteSpace: "pre-wrap" }}>
                {t(
                  open === "privacy"
                    ? settings.profile.policies.privacy
                    : open === "help"
                      ? settings.profile.policies.returns
                      : settings.profile.policies.terms,
                )}
              </p>
              {open !== "privacy" && (
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {t(settings.profile.policies.reservations)}
                </p>
              )}
              <p>
                {settings.profile.name} · {settings.profile.timeZone}
              </p>
              {settings.profile.supportEmail && (
                <p>
                  <a href={`mailto:${settings.profile.supportEmail}`}>
                    {settings.profile.supportEmail}
                  </a>
                </p>
              )}
              {settings.profile.supportPhone && (
                <p>
                  <a href={`tel:${settings.profile.supportPhone}`}>
                    {settings.profile.supportPhone}
                  </a>
                </p>
              )}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
