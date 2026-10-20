"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
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
  Modal,
  ProductCard,
  ProductImage,
  QuantityControl,
  SectionTitle,
} from "./ui";

export function CartPage() {
  const { items, catalog, ready, setQuantity, area, clearCart, notify } =
    useShop();
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState("");
  const [promoError, setPromoError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const totals = cartTotals(items, catalog, promo);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const suggestions = catalog
    .filter((p) => !items.some((item) => item.productId === p.id))
    .slice(-3);
  function applyPromo(event: FormEvent) {
    event.preventDefault();
    if (promoInput.trim().toUpperCase() === "FRESH10") {
      setPromo("FRESH10");
      setPromoError("");
      notify("Fresh10 applied. A little extra goodness!");
    } else {
      setPromoError("Try FRESH10 for 10% off, up to ৳100.");
    }
  }
  return (
    <div className="page-container cart-page">
      <Breadcrumb items={[{ label: "Shopping Cart" }]} />
      <div className="cart-heading">
        <div>
          <h1>
            Shopping Cart<span className="heading-dot">.</span>
          </h1>
          <p>
            {count} {count === 1 ? "item" : "items"} in your cart
          </p>
        </div>
        <div className="checkout-steps">
          <span className="active">
            <i>1</i>Cart
          </span>
          <b />
          <span>
            <i>2</i>Checkout
          </span>
          <b />
          <span>
            <i>3</i>Confirmation
          </span>
        </div>
      </div>
      {!ready ? (
        <div className="loading-state">Getting your basket ready…</div>
      ) : items.length === 0 ? (
        <div className="empty-state cart-empty">
          <div className="empty-basket">
            <ShoppingBag size={56} />
            <Leaf size={22} />
          </div>
          <span className="eyebrow">GOOD THINGS START WITH A FRESH BASKET</span>
          <h2>Your cart is waiting for something good.</h2>
          <p>
            Fresh favourites, everyday essentials and a little extra goodness.
          </p>
          <Link href="/products" className="button primary">
            Start shopping
            <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-layout">
            <section className="cart-table" aria-label="Cart items">
              <div className="cart-table-head">
                <span>Product</span>
                <span>Price</span>
                <span>Quantity</span>
                <span>Total</span>
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
                        <strong>{p.name}</strong>
                        <small>{p.unit}</small>
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
                      aria-label={`Remove ${p.name} from cart`}
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
                      <>Add {money(totals.remaining)} more for free delivery</>
                    ) : (
                      "You’ve unlocked free delivery!"
                    )}
                  </strong>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(100, (totals.subtotal / FREE_DELIVERY_AT) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <small>{money(totals.subtotal)} / ৳1,000</small>
              </div>
            </section>
            <aside className="order-summary">
              <h2>Order Summary</h2>
              <dl className="totals-list">
                <div>
                  <dt>Subtotal ({count} items)</dt>
                  <dd>{money(totals.subtotal)}</dd>
                </div>
                <div>
                  <dt>Delivery fee</dt>
                  <dd>
                    {totals.delivery ? (
                      money(totals.delivery)
                    ) : (
                      <span className="free-label">FREE</span>
                    )}
                  </dd>
                </div>
                {totals.discount > 0 && (
                  <div className="discount-line">
                    <dt>
                      Fresh10 discount
                      <button
                        className="text-button"
                        onClick={() => {
                          setPromo("");
                          setPromoInput("");
                        }}
                      >
                        Remove
                      </button>
                    </dt>
                    <dd>− {money(totals.discount)}</dd>
                  </div>
                )}
                <div className="grand-total">
                  <dt>Total</dt>
                  <dd>{money(totals.total)}</dd>
                </div>
              </dl>
              <form className="promo-form" onSubmit={applyPromo}>
                <label htmlFor="promo-code">Have a promo code?</label>
                <div>
                  <Tag size={17} />
                  <input
                    id="promo-code"
                    placeholder="Enter promo code"
                    maxLength={20}
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    disabled={!!promo}
                  />
                  <button type="submit" disabled={!!promo}>
                    {promo ? <Check size={17} /> : "Apply"}
                  </button>
                </div>
                <small
                  className={promoError ? "form-error" : ""}
                  role={promoError ? "alert" : undefined}
                >
                  {promoError ||
                    (promo
                      ? "FRESH10 applied — enjoy your savings."
                      : "A fresh little treat: use FRESH10 for 10% off.")}
                </small>
              </form>
              <button
                className="button primary checkout-button"
                onClick={() => setCheckoutOpen(true)}
              >
                Proceed to checkout
                <ArrowRight size={19} />
              </button>
              <div className="secure-payments">
                <span>
                  <LockKeyhole size={13} />
                  Secure checkout
                </span>
                <div>
                  <span className="payment-bkash">bKash</span>
                  <span className="payment-visa">VISA</span>
                  <span className="payment-cash">
                    <CreditCard size={17} />
                    Cash on delivery
                  </span>
                </div>
                <p>No payment details stored on this device.</p>
              </div>
            </aside>
          </div>
          <Link className="continue-shopping" href="/products">
            <ArrowLeft size={17} />
            Continue shopping
          </Link>
        </>
      )}
      <SectionTitle
        title={
          items.length
            ? "You might also need"
            : "A few favourites to get you started"
        }
        subtitle="The little things that make the everyday better."
        href="/products"
        linkText="See more products"
      />
      <div className="product-grid cart-suggestions">
        {suggestions.map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>
      <Benefits />
      {checkoutOpen && (
        <CheckoutModal
          promo={promo}
          area={area}
          total={totals.total}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={clearCart}
        />
      )}
    </div>
  );
}

function CheckoutModal({
  promo,
  area,
  total,
  onClose,
  onSuccess,
}: {
  promo: string;
  area: string;
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { items } = useShop();
  const [mode, setMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    reference: string;
    total: number;
    message: string;
  } | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setMode(data.storage))
      .catch(() => {});
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: data.get("name"),
            phone: data.get("phone"),
            address: data.get("address"),
            area,
          },
          items,
          promo,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Unable to place your order.");
      setConfirmation(result);
      onSuccess();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t connect. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      title={confirmation ? "Order received" : "A fresh delivery, just for you"}
      onClose={() => {
        if (!loading) onClose();
      }}
      wide
    >
      {confirmation ? (
        <div className="order-success">
          <CircleCheck size={60} />
          <h3>Thank you for your order!</h3>
          <p>
            Your order number is <strong>{confirmation.reference}</strong>.
          </p>
          <div className="success-total">
            <span>Order total</span>
            <strong>{money(confirmation.total)}</strong>
          </div>
          <p>{confirmation.message}</p>
          <button className="button primary" onClick={onClose}>
            Continue shopping
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <form className="checkout-form" onSubmit={submit}>
          <p className="modal-description">
            Delivery to <strong>{area}, Dhaka</strong>. Payment: cash on
            delivery.
          </p>
          {mode === "demo" && (
            <div className="demo-note">
              Demo checkout: your order is saved locally. No payment is
              collected and no delivery is scheduled.
            </div>
          )}
          <div className="form-grid">
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                placeholder="Your full name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label>
              Mobile number
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                pattern="(\+?88)?01[3-9][0-9]{8}"
                title="Enter a valid Bangladesh mobile number, e.g. 01712345678"
                required
              />
            </label>
          </div>
          <label>
            Delivery address
            <textarea
              name="address"
              autoComplete="street-address"
              placeholder="House, road, apartment and any delivery directions"
              minLength={10}
              maxLength={300}
              rows={3}
              required
            />
          </label>
          <div className="checkout-total">
            <span>Total to pay on delivery</span>
            <strong>{money(total)}</strong>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" type="submit" disabled={loading}>
            {loading
              ? "Saving your order…"
              : `${mode === "demo" ? "Place demo order" : "Place order"} · ${money(total)}`}
            <ArrowRight size={18} />
          </button>
          <small className="checkout-privacy">
            Your delivery details are used only to save this order.
          </small>
        </form>
      )}
    </Modal>
  );
}
