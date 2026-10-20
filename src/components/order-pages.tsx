"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "./account-provider";
import { useShop } from "./shop-provider";
import { api } from "@/lib/client-api";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  CircleCheck,
  Home,
  Leaf,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { money } from "@/lib/commerce";
import {
  formatDelivery,
  orderTime,
  type Order,
  type OrderReceipt,
  type SavedAddress,
} from "@/lib/orders";
import { readReceipts } from "@/lib/order-browser";
import { AddressForm } from "./address-form";
import { Benefits, Breadcrumb, Modal } from "./ui";
import { OrderTotals, PolicyLinks, SnapshotPhoto } from "./order-ui";

const statuses = {
  placed: "Order placed",
  preparing: "Preparing",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
function useOrder(reference: string) {
  const { user, ready } = useAccount();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const token = useRef("");
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const receipt = readReceipts().find((item) => item.reference === reference);
    token.current = receipt?.accessToken || "";
    setOrder(null);
    setLoading(true);
    setError("");
    fetch(`/api/orders/${encodeURIComponent(reference)}`, {
      headers: receipt
        ? { Authorization: `Bearer ${receipt.accessToken}` }
        : {},
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => {
          throw new Error(
            "FreshCart is temporarily unavailable. Please try again.",
          );
        });
        if (!response.ok)
          throw new Error(result.message || "Unable to load your order.");
        setOrder(result.order);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to connect. Please try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reference, version, user?.id, ready]);
  return {
    order,
    setOrder,
    loading,
    error,
    token: token.current,
    refresh: () => setVersion((v) => v + 1),
  };
}

export function OrderConfirmation({ reference }: { reference: string }) {
  const { order, setOrder, loading, error, token, refresh } =
    useOrder(reference);
  const [editing, setEditing] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);
  if (loading && !order)
    return (
      <div className="page-container loading-state">Opening your order…</div>
    );
  if (!order)
    return (
      <div className="page-container empty-state">
        <ShoppingBag size={48} />
        <h1>We couldn’t open this order.</h1>
        <p>{error}</p>
        <div className="order-empty-actions">
          <button className="button outline" onClick={refresh}>
            Try again
          </button>
          <Link className="button primary" href="/orders">
            View saved orders
          </Link>
        </div>
      </div>
    );
  const stage = [
    "placed",
    "preparing",
    "out-for-delivery",
    "delivered",
  ].indexOf(order.status);
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  async function changeAddress(address: SavedAddress) {
    const response = await fetch(`/api/orders/${order!.reference}/address`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customer: {
          name: address.name,
          phone: address.phone,
          address: address.address,
          area: address.area,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message || "We couldn’t update the address.");
    setOrder(result.order);
    setEditing(false);
  }
  return (
    <div className="page-container confirmation-page">
      <Breadcrumb
        items={[
          { label: "Orders", href: "/orders" },
          { label: order.reference },
        ]}
      />
      <section className="confirmation-banner">
        <div className="confirmation-intro">
          <span className="confirmation-check">
            <Check size={49} strokeWidth={3} />
          </span>
          <div>
            <h1>
              {order.status === "cancelled"
                ? "This order was cancelled."
                : "Thank you for your order!"}
            </h1>
            <p>
              {order.mode === "demo"
                ? "Your demo order has been saved."
                : order.status === "preparing"
                  ? "Your groceries are being prepared."
                  : order.status === "out-for-delivery"
                    ? "Your groceries are on their way."
                    : order.status === "delivered"
                      ? "Your groceries have been delivered."
                      : "Your order has been received."}
            </p>
            <span>
              Order number: <strong>#{order.reference}</strong>
            </span>
          </div>
        </div>
        <ol className="order-timeline">
          {[
            {
              id: "placed",
              icon: Check,
              description: orderTime(order.createdAt),
            },
            {
              id: "preparing",
              icon: Package,
              description: "Freshness, carefully packed",
            },
            {
              id: "out-for-delivery",
              icon: Truck,
              description: "On the way to your door",
            },
            {
              id: "delivered",
              icon: Home,
              description: "Goodness at your doorstep",
            },
          ].map((step, index) => (
            <li
              key={step.id}
              className={
                index < stage ? "complete" : index === stage ? "current" : ""
              }
              aria-current={index === stage ? "step" : undefined}
            >
              <span>
                <step.icon size={23} />
              </span>
              <strong>{statuses[step.id as keyof typeof statuses]}</strong>
              <small>{step.description}</small>
            </li>
          ))}
        </ol>
        <div className="order-status-row">
          <span className={`order-status status-${order.status}`}>
            {statuses[order.status]}
          </span>
          {order.mode === "demo" && (
            <span>Demo order · No delivery is scheduled.</span>
          )}
          <button onClick={refresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? "refreshing" : ""} />
            {loading ? "Refreshing…" : "Refresh status"}
          </button>
        </div>
      </section>
      {error && (
        <p className="form-error order-refresh-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirmation-layout">
        <section className="order-details-card">
          <h2>Order details</h2>
          <p>
            {count} {count === 1 ? "item" : "items"}
          </p>
          <div className="order-detail-labels">
            <span>Item</span>
            <span>Quantity</span>
            <span>Price</span>
          </div>
          {order.items.map((item) => (
            <div className="order-detail-row" key={item.productId}>
              <div>
                <SnapshotPhoto item={item} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.unit}</small>
                </span>
              </div>
              <span>{item.quantity}</span>
              <strong>{money(item.price * item.quantity)}</strong>
            </div>
          ))}
          <OrderTotals order={order} />
        </section>
        <aside className="order-info-column">
          <section className="order-info-card">
            <div className="order-info-heading">
              <span className="info-icon orange">
                <MapPin size={26} />
              </span>
              <div>
                <h2>Delivery details</h2>
                <p>Your selected delivery information</p>
              </div>
            </div>
            <div className="order-info-content">
              <div>
                <CalendarDays size={25} />
                <span>
                  <strong>{formatDelivery(order.deliverySelection)}</strong>
                  <small>Selected delivery slot · Dhaka time</small>
                </span>
              </div>
              <div>
                <MapPin size={25} />
                <span>
                  <strong>{order.customer.address}</strong>
                  <small>{order.customer.area}, Dhaka</small>
                  <small>
                    {order.customer.name} · {order.customer.phone}
                  </small>
                </span>
                {order.status === "placed" && (
                  <button
                    className="change-address"
                    onClick={() => setEditing(true)}
                  >
                    Change
                  </button>
                )}
              </div>
              {order.instructions && (
                <div className="order-instructions">
                  <Leaf size={20} />
                  <span>
                    <strong>Delivery instructions</strong>
                    <small>{order.instructions}</small>
                  </span>
                </div>
              )}
            </div>
          </section>
          <section className="order-info-card">
            <div className="order-info-heading">
              <span className="info-icon green">
                <Banknote size={26} />
              </span>
              <div>
                <h2>Payment</h2>
                <p>
                  {order.payment === "online"
                    ? "Online payment via SSLCOMMERZ."
                    : "You chose cash on delivery."}
                </p>
              </div>
            </div>
            <div className="order-info-content">
              <div>
                <Banknote size={27} />
                <span>
                  <strong>
                    {order.payment === "online"
                      ? `${order.sandbox ? "Sandbox · " : ""}${order.paymentStatus === "paid" ? "Payment verified" : order.paymentStatus === "review" ? "Payment under review" : "Awaiting payment"}`
                      : "Cash on delivery"}
                  </strong>
                  <small>
                    {order.payment === "online"
                      ? `Order total ${money(order.total)}`
                      : order.mode === "demo"
                        ? "Demo order — no payment is due."
                        : `Pay ${money(order.total)} on arrival`}
                  </small>
                </span>
              </div>
            </div>
          </section>
          {order.payment === "online" &&
            order.paymentStatus === "pending" &&
            order.status === "placed" && (
              <>
                <button
                  className="button primary"
                  disabled={paying}
                  onClick={async () => {
                    setPaying(true);
                    setPaymentError("");
                    try {
                      const result = await api<{ paymentUrl: string }>(
                        `/orders/${order.reference}/pay`,
                        {
                          method: "POST",
                          body: "{}",
                          headers: token
                            ? { Authorization: `Bearer ${token}` }
                            : {},
                        },
                      );
                      window.location.assign(result.paymentUrl);
                    } catch (e) {
                      setPaymentError((e as Error).message);
                      setPaying(false);
                    }
                  }}
                >
                  {paying ? "Opening gateway…" : "Continue to payment"}
                </button>
                <p className="muted">
                  Unpaid reservations expire after 30 minutes.
                </p>
              </>
            )}
          {paymentError && (
            <p className="form-error" role="alert">
              {paymentError}
            </p>
          )}
          <BuyAgain order={order} />
          <Link href="/products" className="button primary">
            Continue shopping
            <ArrowRight size={19} />
          </Link>
          <Link href="/orders" className="button order-secondary-button">
            View all orders
          </Link>
          <OrderSupport reference={order.reference} token={token} />
        </aside>
      </div>
      <Benefits />
      {editing && (
        <AddressForm
          initial={{ ...order.customer, id: order.reference, label: "Home" }}
          area={order.customer.area}
          onSave={changeAddress}
          onClose={() => setEditing(false)}
          orderOnly
        />
      )}
    </div>
  );
}

type HistoryItem = { receipt: OrderReceipt; order?: Order; failed?: boolean };
export function OrdersPage() {
  const { user, ready } = useAccount();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    const receipts = readReceipts();
    setHistoryError("");
    const guestOrders = Promise.all(
      receipts.map(async (receipt) => {
        try {
          const response = await fetch(`/api/orders/${receipt.reference}`, {
            headers: { Authorization: `Bearer ${receipt.accessToken}` },
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error();
          const result = await response.json();
          return { receipt, order: result.order as Order };
        } catch {
          return { receipt, failed: true };
        }
      }),
    );
    const accountOrders = user
      ? api<{ orders: Order[] }>("/me/orders", {
          signal: controller.signal,
        }).then((d) =>
          d.orders.map(
            (order) =>
              ({
                order,
                receipt: {
                  reference: order.reference,
                  accessToken: "",
                  total: order.total,
                  createdAt: order.createdAt,
                },
              }) as HistoryItem,
          ),
        )
      : Promise.resolve([] as HistoryItem[]);
    Promise.all([guestOrders, accountOrders])
      .then(([guest, account]) =>
        [
          ...new Map(
            [...guest, ...account].map((h) => [h.receipt.reference, h]),
          ).values(),
        ].sort((a, b) =>
          b.receipt.createdAt.localeCompare(a.receipt.createdAt),
        ),
      )
      .then((result) => {
        if (!controller.signal.aborted) {
          setHistory(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistory([]);
          setLoading(false);
          setHistoryError(
            "Unable to load your orders. Please refresh to try again.",
          );
        }
      });
    return () => controller.abort();
  }, [version, user?.id, ready]);
  const [historyError, setHistoryError] = useState("");
  return (
    <div className="page-container orders-page">
      <Breadcrumb items={[{ label: "Your orders" }]} />
      <div className="orders-heading">
        <div>
          <span className="eyebrow">YOUR FRESH FINDS</span>
          <h1>Your orders</h1>
          <p>
            {user
              ? "Your orders, available wherever you sign in."
              : "Orders placed in this browser. Sign in to keep them across devices."}
          </p>
        </div>
        <button
          className="button outline"
          onClick={() => setVersion((v) => v + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      {historyError && (
        <p className="form-error" role="alert">
          {historyError}
        </p>
      )}
      {loading ? (
        <div className="loading-state">Finding your orders…</div>
      ) : !history.length ? (
        <div className="empty-state">
          <ShoppingBag size={49} />
          <h2>Your next fresh delivery starts here.</h2>
          <p>
            Once you place an order, you can find its details and status here.
          </p>
          <Link href="/products" className="button primary">
            Start shopping
            <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="order-history-list">
          {history.map(({ receipt, order, failed }) => (
            <article className="order-history-card" key={receipt.reference}>
              <div className="history-card-heading">
                <span>
                  <strong>#{receipt.reference}</strong>
                  <small>{orderTime(receipt.createdAt)} · Dhaka time</small>
                </span>
                {order && (
                  <span className={`order-status status-${order.status}`}>
                    {statuses[order.status]}
                  </span>
                )}
              </div>
              <div className="history-card-content">
                <div className="history-photos">
                  {order?.items.slice(0, 4).map((item) => (
                    <SnapshotPhoto item={item} key={item.productId} />
                  ))}
                  {failed && (
                    <p>
                      Order details are unavailable. Open the order to try
                      again.
                    </p>
                  )}
                </div>
                <div className="history-total">
                  <strong>{money(order?.total ?? receipt.total)}</strong>
                  <small>
                    {order
                      ? `${order.items.reduce((n, item) => n + item.quantity, 0)} items · ${order.mode === "demo" ? "Demo order" : "Cash on delivery"}`
                      : "Saved order receipt"}
                  </small>
                </div>
                <Link
                  href={`/orders/${receipt.reference}`}
                  className="button outline"
                >
                  View order
                  <ArrowRight size={16} />
                </Link>
                {order && <BuyAgain order={order} />}
              </div>
            </article>
          ))}
        </div>
      )}
      <Link className="continue-shopping" href="/products">
        <ArrowLeft size={16} />
        Continue shopping
      </Link>
    </div>
  );
}

function BuyAgain({ order }: { order: Order }) {
  const { addMany, refreshCatalog, ready } = useShop();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        className="button outline"
        disabled={busy || !ready}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const current = await refreshCatalog();
            const added = addMany(
              order.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
              })),
              false,
              current,
            );
            if (added) router.push("/cart");
            else setBusy(false);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking stock…" : "Buy again"}
        <ShoppingBag size={16} />
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function OrderSupport({
  reference,
  token,
}: {
  reference: string;
  token: string;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button className="order-help" onClick={() => setOpen(true)}>
        Need help? <span>Contact the store</span>
      </button>
      {open && (
        <Modal
          title="Help with your order"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p className="modal-description">
            Order #{reference}. Describe missing or damaged items, or your
            delivery question. Your request goes to the store’s admin panel.
          </p>
          {message ? (
            <p className="success-message" role="status">
              {message}
            </p>
          ) : (
            <form
              className="enhance-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const data = await api<{ message: string }>(
                    `/orders/${reference}/support`,
                    {
                      method: "POST",
                      body: JSON.stringify({ message: form.get("message") }),
                      headers: token
                        ? { Authorization: `Bearer ${token}` }
                        : {},
                    },
                  );
                  setMessage(data.message);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                How can we help?
                <textarea
                  name="message"
                  rows={4}
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? "Saving request…" : "Send request"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
