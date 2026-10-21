"use client";
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
      aria-label="Your basket"
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
            <span className="eyebrow">A LITTLE BASKET OF GOODNESS</span>
            <h2>
              Your basket <span>{count}</span>
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close basket"
            onClick={() => setMiniCartOpen(false)}
          >
            <X size={23} />
          </button>
        </header>
        <div className="mini-cart-body">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {!ready ? (
            <div className="loading-state">Getting your basket ready…</div>
          ) : !items.length ? (
            <div className="mini-cart-empty">
              <span className="round-icon">
                <ShoppingBag size={38} />
              </span>
              <h3>Good things start here.</h3>
              <p>
                Fresh favourites and everyday essentials are waiting for your
                basket.
              </p>
              <Link
                className="button primary"
                href="/products"
                onClick={() => setMiniCartOpen(false)}
              >
                Find something fresh <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <>
              {updating && (
                <p className="mini-refresh-note" role="status">
                  Updating current prices & stock…
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
                        <strong>{p.name}</strong>
                      </Link>
                      <small>{p.unit}</small>
                      <QuantityControl
                        compact
                        quantity={item.quantity}
                        max={Math.min(100, p.stock)}
                        label={`${p.name} ${p.unit} in mini basket`}
                        disabled={updating}
                        onChange={(value) => setQuantity(p.id, value)}
                      />
                    </div>
                    <div>
                      <strong>{money(p.price * item.quantity)}</strong>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${p.name} ${p.unit} from basket`}
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
                      ? `${money(total.remaining)} away from free delivery`
                      : "Free delivery unlocked"}
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
                <ListChecks size={17} /> Save this basket as a list{" "}
                <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
        <footer>
          {items.length > 0 && (
            <>
              <dl>
                <div>
                  <dt>Products subtotal</dt>
                  <dd>{money(total.subtotal)}</dd>
                </div>
                <div>
                  <dt>Delivery to {area}</dt>
                  <dd>{total.delivery ? money(total.delivery) : "FREE"}</dd>
                </div>
                {total.discount > 0 && (
                  <div>
                    <dt>{promoCode} savings</dt>
                    <dd>− {money(total.discount)}</dd>
                  </div>
                )}
                <div className="mini-grand-total">
                  <dt>Total</dt>
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
                Checkout <ArrowRight size={18} />
              </Link>
              <Link
                className="button outline"
                href="/cart"
                onClick={() => setMiniCartOpen(false)}
              >
                View full basket
              </Link>
            </>
          )}
          <span className="mini-cart-note">
            <Leaf size={14} /> Fresh choices. A little closer.
          </span>
        </footer>
      </div>
    </dialog>
  );
}
