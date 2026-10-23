"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Check,
  Leaf,
  ListChecks,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useShop } from "./shop-provider";
import { cartTotals, money } from "@/lib/commerce";
import { ProductImage, QuantityControl } from "./ui";

export function MiniCart() {
  const { t } = useLanguage();
  const {
    miniCartOpen,
    setMiniCartOpen,
    items,
    catalog,
    ready,
    setQuantity,
    promoCode,
    settings,
    area,
    refreshCatalog,
  } = useShop();
  const dialog = useRef<HTMLDialogElement>(null),
    path = usePathname();
  const [error, setError] = useState(""),
    [updating, setUpdating] = useState(false);
  const total = cartTotals(items, catalog, promoCode, settings, area);
  const count = items.reduce((n, i) => n + i.quantity, 0);
  useEffect(() => {
    setMiniCartOpen(false);
  }, [path]);
  useEffect(() => {
    if (!miniCartOpen) return;
    const node = dialog.current!,
      focus = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    setUpdating(true);
    setError("");
    void refreshCatalog()
      .catch(() =>
        setError(
          "Could not refresh current prices. Try again before checkout.",
        ),
      )
      .finally(() => setUpdating(false));
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      focus?.focus();
    };
  }, [miniCartOpen]);
  if (!miniCartOpen) return null;
  return (
    <dialog
      ref={dialog}
      className="mini-cart-drawer"
      aria-label={t("Your basket")}
      onCancel={(e) => {
        e.preventDefault();
        setMiniCartOpen(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setMiniCartOpen(false);
      }}
    >
      <div className="mini-cart-shell">
        <header>
          <div>
            <span className="eyebrow">{t("A LITTLE BASKET OF GOODNESS")}</span>
            <h2>
              {t("Your basket ")}
              <span>{count}</span>
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label={t("Close basket")}
            onClick={() => setMiniCartOpen(false)}
          >
            <X size={23} />
          </button>
        </header>
        <div className="mini-cart-body">
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          {!ready ? (
            <div className="loading-state">
              {t("Getting your basket ready…")}
            </div>
          ) : !items.length ? (
            <div className="mini-cart-empty">
              <span className="round-icon">
                <ShoppingBag size={38} />
              </span>
              <h3>{t("Good things start here.")}</h3>
              <p>
                {t(
                  "Fresh favourites and everyday essentials are waiting for your basket.",
                )}
              </p>
              <Link
                className="button primary"
                href="/products"
                onClick={() => setMiniCartOpen(false)}
              >
                {t("Find something fresh ")}
                <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <>
              {updating && (
                <p className="mini-refresh-note" role="status">
                  {t("Updating current prices & stock…")}
                </p>
              )}
              {items.map((item) => {
                const p = catalog.find((p) => p.id === item.productId);
                if (!p) return null;
                return (
                  <article className="mini-cart-line" key={p.id}>
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={() => setMiniCartOpen(false)}
                    >
                      <ProductImage product={p} />
                    </Link>
                    <div>
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={() => setMiniCartOpen(false)}
                      >
                        <strong>{t(p.name)}</strong>
                      </Link>
                      <small>{t(p.unit)}</small>
                      <QuantityControl
                        compact
                        quantity={item.quantity}
                        max={Math.min(100, p.stock)}
                        label={`${t(p.name)} ${t(p.unit)}`}
                        disabled={updating}
                        onChange={(value) => setQuantity(p.id, value)}
                      />
                    </div>
                    <div>
                      <strong>{money(p.price * item.quantity)}</strong>
                      <button
                        className="icon-button"
                        aria-label={t("Remove {name}", {
                          name: `${t(p.name)} ${t(p.unit)}`,
                        })}
                        disabled={updating}
                        onClick={() => setQuantity(p.id, 0)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
              <div className="mini-delivery-progress">
                <Truck size={23} />
                <div>
                  <strong>
                    {total.remaining > 0
                      ? t("{amount} away from free delivery", {
                          amount: money(total.remaining),
                        })
                      : t("Free delivery unlocked")}
                  </strong>
                  <div>
                    <span
                      style={{
                        width: `${Math.min(100, (total.subtotal / settings.freeDeliveryAt) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <Link
                className="save-basket-list"
                href="/lists?from=cart"
                onClick={() => setMiniCartOpen(false)}
              >
                <ListChecks size={17} />
                {t(" Save this basket as a list")} <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
        <footer>
          {items.length > 0 && (
            <>
              <dl>
                <div>
                  <dt>{t("Products subtotal")}</dt>
                  <dd>{money(total.subtotal)}</dd>
                </div>
                <div>
                  <dt>
                    {t("Delivery to ")}
                    {area}
                  </dt>
                  <dd>{total.delivery ? money(total.delivery) : "FREE"}</dd>
                </div>
                {total.discount > 0 && (
                  <div>
                    <dt>
                      {promoCode}
                      {t(" savings")}
                    </dt>
                    <dd>− {money(total.discount)}</dd>
                  </div>
                )}
                <div className="mini-grand-total">
                  <dt>{t("Total")}</dt>
                  <dd>{money(total.total)}</dd>
                </div>
              </dl>
              <Link
                className="button primary"
                href="/checkout"
                aria-disabled={!ready || updating}
                onClick={(e) => {
                  if (!ready || updating) e.preventDefault();
                  else setMiniCartOpen(false);
                }}
              >
                {t("Checkout ")}
                <ArrowRight size={18} />
              </Link>
              <Link
                className="button outline"
                href="/cart"
                onClick={() => setMiniCartOpen(false)}
              >
                {t("View full basket")}
              </Link>
            </>
          )}
          <span className="mini-cart-note">
            <Leaf size={14} />
            {t(" Fresh choices. A little closer.")}
          </span>
        </footer>
      </div>
    </dialog>
  );
}
