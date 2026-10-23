"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { Check, CircleHelp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { money } from "@/lib/commerce";
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
              {open === "privacy" ? (
                <>
                  <p>
                    {t(
                      "Guest baskets, addresses and order access receipts are saved in this browser. When signed in, your profile, delivery addresses, basket and linked orders are stored with your account and available on your other devices.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Local demo data is saved on this computer. A configured store uses MongoDB. Card and bKash payment details are collected on the payment gateway, never by FreshCart. Sign out on shared devices.",
                    )}
                  </p>
                </>
              ) : open === "help" ? (
                <>
                  <p>
                    {t(
                      "Open an order to review its items, total, selected delivery time and current status. You can change its address while the status is “Order placed”.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Demo orders don’t schedule a delivery. Online payments are available only when the store configures its gateway. Sandbox payments are for testing.",
                    )}
                  </p>
                  <p>
                    {t(
                      "For a missing order, sign in to the account used at checkout, or use the original browser for a guest order. Address changes are available before preparation begins; contact the store for an area change.",
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {t(
                      "Delivery charges depend on your area. Delivery is free when the product subtotal reaches",
                    )}{" "}
                    {money(settings.freeDeliveryAt)}
                    {t(
                      ". The checkout shows your exact total and any valid promo discount. Cash on delivery is available; online payment uses the configured gateway.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Delivery times are in Dhaka time. Slots close one hour before they start. Order totals and availability are checked again when you place an order.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Demo orders are saved for testing and do not arrange delivery. Unpaid online reservations expire after 30 minutes. Payment is marked paid only after server verification; a gateway return screen alone does not confirm payment.",
                    )}
                  </p>
                </>
              )}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
