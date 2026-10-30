"use client";
import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import {
  emptyOrderFilters,
  filterAdminOrders,
  nextOrderStatuses,
  orderStatuses,
  orderStatusLabel,
  adminOrderDelivery,
  type OrderFilters,
} from "@/lib/admin-workspace";
import type { Order, OrderStatus } from "@/lib/orders";

import type { StoreSettings } from "@/lib/storefront";
import { can } from "@/lib/management";
import type { Account } from "@/lib/storefront";
import { AdminDrawer } from "./admin-shell";
import { useStoreFormat } from "./store-format";
import { OrderOperationsPanel } from "./admin-operations";
import { OrderFinancePanel } from "./admin-finance";
import { SnapshotPhoto } from "./order-ui";

function PaymentBadge({ order }: { order: Order }) {
  return (
    <span
      className={`workspace-payment ${order.payment === "online" ? order.paymentStatus || "pending" : "cod"}`}
    >
      <i />
      {order.payment === "cash-on-delivery"
        ? "Cash on delivery"
        : order.paymentStatus === "paid"
          ? "Online · Paid"
          : order.paymentStatus === "review"
            ? "Online · Needs review"
            : order.paymentStatus === "unpaid"
              ? "Online · Unpaid"
              : "Online · Pending"}
    </span>
  );
}
export function AdminOrders({
  orders,
  settings,
  role,
  initialFilters,
  busy,
  error,
  updateStatus,
  refresh,
}: {
  orders: Order[];
  settings: StoreSettings;
  role: Account["role"];
  initialFilters: Partial<OrderFilters>;
  busy: boolean;
  error: string;
  updateStatus: (reference: string, status: OrderStatus) => Promise<boolean>;
  refresh: () => void;
}) {
  const { money, orderTime } = useStoreFormat();
  const [filters, setFilters] = useState<OrderFilters>({
    ...emptyOrderFilters,
    ...initialFilters,
  });
  const [more, setMore] = useState(
    !!(
      initialFilters.area ||
      initialFilters.from ||
      initialFilters.to ||
      initialFilters.payment ||
      initialFilters.deliveryDate
    ),
  );
  const [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [selectedRef, setSelectedRef] = useState<string | null>(null);
  const selected = orders.find((order) => order.reference === selectedRef);
  function update(patch: Partial<OrderFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
  }
  const filtered = filterAdminOrders(
      orders,
      filters,
      settings.profile.timeZone,
    ),
    totalPages = Math.max(1, Math.ceil(filtered.length / size)),
    current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * size, current * size);
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => key !== "sort" && !!value,
  );
  const areas = [
    ...new Set([
      ...settings.zones.map((zone) => zone.name),
      ...orders.map((order) => order.customer.area),
    ]),
  ];
  const counts = (status: string) =>
    orders.filter(
      (order) =>
        status === "" ||
        (status === "open"
          ? !["delivered", "cancelled"].includes(order.status)
          : order.status === status),
    ).length;
  return (
    <div className="workspace-orders">
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">FROM PLACED TO DELIVERED</span>
          <h1>Orders</h1>
          <p>
            Keep every delivery moving. Open an order to see details and next
            steps.
          </p>
        </div>
        <span className="workspace-total-count">
          <ShoppingBag size={17} />
          {orders.length} orders
        </span>
      </div>
      <section className="workspace-panel workspace-orders-panel">
        <div
          className="workspace-order-tabs"
          role="group"
          aria-label="Filter orders by fulfilment status"
        >
          {[{ id: "", label: "All orders" }, ...orderStatuses].map((status) => (
            <button
              className={filters.status === status.id ? "active" : ""}
              key={status.id}
              aria-pressed={filters.status === status.id}
              onClick={() => update({ status: status.id })}
            >
              {status.label}
              <span>{counts(status.id)}</span>
            </button>
          ))}
        </div>
        <div className="workspace-order-toolbar">
          <label className="workspace-order-search">
            <Search size={18} />
            <input
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
              placeholder="Search order, customer, phone or area…"
              aria-label="Search orders"
            />
            {filters.query && (
              <button
                aria-label="Clear order search"
                onClick={() => update({ query: "" })}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <div>
            <button
              className={`button outline ${more ? "workspace-filter-active" : ""}`}
              aria-expanded={more}
              aria-controls="workspace-order-filters"
              onClick={() => setMore(!more)}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilters.length > 0 && (
                <span className="workspace-count">{activeFilters.length}</span>
              )}
            </button>
            <label className="workspace-sort">
              <ArrowDownWideNarrow size={17} />
              <select
                aria-label="Sort orders"
                value={filters.sort}
                onChange={(event) =>
                  update({ sort: event.target.value as OrderFilters["sort"] })
                }
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="delivery">Delivery date</option>
              </select>
            </label>
          </div>
        </div>
        {more && (
          <div className="workspace-order-filters" id="workspace-order-filters">
            <label>
              Payment
              <select
                aria-label="Filter payment status"
                value={filters.payment}
                onChange={(event) => update({ payment: event.target.value })}
              >
                <option value="">All payments</option>
                <option value="cod">Cash on delivery</option>
                <option value="paid">Online · Paid</option>
                <option value="pending">Online · Pending</option>
                <option value="unpaid">Online · Unpaid</option>
                <option value="review">Online · Needs review</option>
              </select>
            </label>
            <label>
              Delivery area
              <select
                aria-label="Filter delivery area"
                value={filters.area}
                onChange={(event) => update({ area: event.target.value })}
              >
                <option value="">All areas</option>
                {areas.map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </select>
            </label>
            <label>
              Ordered from
              <input
                type="date"
                value={filters.from}
                onChange={(event) => update({ from: event.target.value })}
              />
            </label>
            <label>
              Ordered through
              <input
                type="date"
                value={filters.to}
                onChange={(event) => update({ to: event.target.value })}
              />
            </label>
            <label>
              Open delivery date
              <input
                type="date"
                value={filters.deliveryDate}
                onChange={(event) =>
                  update({ deliveryDate: event.target.value })
                }
              />
            </label>
            <p>
              Order dates use the timezone saved on each order, or{" "}
              {settings.profile.timeZone}. Delivery dates are local scheduled
              dates.
            </p>
          </div>
        )}
        {activeFilters.length > 0 && (
          <div className="workspace-active-filters">
            <span>
              <Filter size={13} />
              {filtered.length} matching orders
            </span>
            {filters.status === "open" && (
              <span className="workspace-filter-chip">Awaiting fulfilment</span>
            )}
            {filters.deliveryDate && (
              <span className="workspace-filter-chip">
                Open deliveries · {filters.deliveryDate}
              </span>
            )}
            <button
              onClick={() => {
                setFilters({ ...emptyOrderFilters });
                setPage(1);
              }}
            >
              Clear filters <X size={13} />
            </button>
          </div>
        )}
        {filters.from && filters.to && filters.from > filters.to && (
          <p className="workspace-inline-error" role="alert">
            Choose an end date on or after the start date.
          </p>
        )}
        {rows.length ? (
          <div className="workspace-orders-table-wrap">
            <table className="workspace-orders-table">
              <thead>
                <tr>
                  <th scope="col">Order / customer</th>
                  <th scope="col">Delivery</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Fulfilment</th>
                  <th scope="col">Total</th>
                  <th scope="col">
                    <span className="sr-only">Open order</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.reference}>
                    <td>
                      <button
                        className="workspace-order-reference"
                        onClick={() => setSelectedRef(order.reference)}
                      >
                        #{order.reference}
                      </button>
                      <strong className="workspace-customer-name">
                        {order.customer.name}
                      </strong>
                      <small>
                        {orderTime(
                          order.createdAt,
                          "en",
                          order.timeZone || settings.profile.timeZone,
                        )}
                        {order.mode === "demo"
                          ? " · Demo"
                          : order.sandbox
                            ? " · Sandbox"
                            : ""}
                      </small>
                    </td>
                    <td data-label="Delivery">
                      <span className="workspace-delivery-area">
                        <MapPin size={13} />
                        {order.customer.area}
                      </span>
                      <small>{adminOrderDelivery(order)}</small>
                    </td>
                    <td data-label="Payment">
                      <PaymentBadge order={order} />
                    </td>
                    <td data-label="Fulfilment">
                      <span className={`workspace-status ${order.status}`}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td data-label="Total">
                      <strong className="workspace-order-price">
                        {money(
                          order.total,
                          order.currency || settings.profile.currency,
                        )}
                      </strong>
                      <small>
                        {order.items.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        )}{" "}
                        items
                      </small>
                    </td>
                    <td>
                      <button
                        className="workspace-order-open"
                        onClick={() => setSelectedRef(order.reference)}
                        aria-label={`View order ${order.reference}`}
                      >
                        View <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="workspace-empty workspace-orders-empty">
            <Search size={30} />
            <h2>
              {orders.length
                ? "No orders match these filters"
                : "Your first order will appear here"}
            </h2>
            <p>
              {orders.length
                ? "Try a different search or clear your filters."
                : "New orders will be ready to review when customers check out."}
            </p>
            {activeFilters.length > 0 && (
              <button
                className="button outline"
                onClick={() => {
                  setFilters({ ...emptyOrderFilters });
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        <footer className="workspace-pagination">
          <span>
            {filtered.length
              ? `${(current - 1) * size + 1}–${Math.min(current * size, filtered.length)} of ${filtered.length} orders`
              : "0 orders"}
          </span>
          <div>
            <label>
              Per page
              <select
                aria-label="Orders per page"
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
            </label>
            <button
              className="workspace-icon"
              disabled={current <= 1}
              aria-label="Previous orders page"
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {current} / {totalPages}
            </span>
            <button
              className="workspace-icon"
              disabled={current >= totalPages}
              aria-label="Next orders page"
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </section>
      {selected && (
        <OrderDetail
          key={selected.reference}
          order={selected}
          settings={settings}
          role={role}
          busy={busy}
          error={error}
          updateStatus={updateStatus}
          refresh={refresh}
          onClose={() => {
            if (!busy) setSelectedRef(null);
          }}
        />
      )}
    </div>
  );
}
function OrderDetail({
  order,
  settings,
  role,
  busy,
  error,
  updateStatus,
  refresh,
  onClose,
}: {
  order: Order;
  settings: StoreSettings;
  role: Account["role"];
  busy: boolean;
  error: string;
  updateStatus: (reference: string, status: OrderStatus) => Promise<boolean>;
  refresh: () => void;
  onClose: () => void;
}) {
  const { money, orderTime } = useStoreFormat();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  return (
    <AdminDrawer title={`Order ${order.reference}`} onClose={onClose}>
      <div className="workspace-order-detail">
        <div className="workspace-detail-meta">
          <span className={`workspace-status ${order.status}`}>
            {orderStatusLabel(order.status)}
          </span>
          <PaymentBadge order={order} />
          <small>
            {order.mode === "demo"
              ? "Local demo order"
              : order.sandbox
                ? "Sandbox order"
                : "Customer order"}{" "}
            ·{" "}
            {orderTime(
              order.createdAt,
              "en",
              order.timeZone || settings.profile.timeZone,
            )}
          </small>
        </div>
        <section className="workspace-detail-section">
          <h3>
            <MapPin size={17} /> Customer & delivery
          </h3>
          <strong>{order.customer.name}</strong>
          <p>{order.customer.phone}</p>
          <p>
            {order.customer.address}
            <br />
            {order.customer.area}
          </p>
          <div className="workspace-delivery-slot">
            <CalendarDays size={18} />
            <span>
              {adminOrderDelivery(order)}
              <small>{order.timeZone || settings.profile.timeZone}</small>
            </span>
          </div>
          {order.instructions && (
            <p className="workspace-delivery-note">
              <strong>Delivery note:</strong> {order.instructions}
            </p>
          )}
        </section>
        <section className="workspace-detail-section">
          <h3>
            <ShoppingBag size={17} />
            Items & totals
          </h3>
          {order.items.map((item) => (
            <div className="workspace-detail-item" key={item.productId}>
              <SnapshotPhoto item={item} />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.quantity} × {item.unit}
                </small>
              </span>
              <b>{money(item.price * item.quantity, order.currency)}</b>
            </div>
          ))}
          <dl className="workspace-detail-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal, order.currency)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{money(order.delivery, order.currency)}</dd>
            </div>
            {order.discount > 0 && (
              <div>
                <dt>Discount {order.promoCode}</dt>
                <dd>−{money(order.discount, order.currency)}</dd>
              </div>
            )}
            <div>
              <dt>Total</dt>
              <dd>{money(order.total, order.currency)}</dd>
            </div>
          </dl>
        </section>
        <section className="workspace-detail-section">
          <h3>
            <Truck size={17} />
            Next step
          </h3>
          <p>
            Status changes use the existing order, payment and inventory checks.
          </p>
          {error && (
            <p className="workspace-inline-error" role="alert">
              {error}
            </p>
          )}
          {pending ? (
            <div className="workspace-status-review">
              <strong>
                {orderStatusLabel(order.status)} <ArrowRight size={14} />{" "}
                {orderStatusLabel(pending)}
              </strong>
              <p>
                {pending === "cancelled"
                  ? "Cancellation will be checked against payment, refund and inventory requirements. No refund is sent by this action."
                  : "Confirm the physical order is ready for this step. The change is recorded in order history."}
              </p>
              <div className="inline-actions">
                <button
                  className={`button ${pending === "cancelled" ? "outline workspace-danger" : "primary"}`}
                  disabled={busy}
                  onClick={async () => {
                    if (await updateStatus(order.reference, pending))
                      setPending(null);
                  }}
                >
                  {busy
                    ? "Updating…"
                    : pending === "cancelled"
                      ? "Confirm cancellation"
                      : "Confirm status change"}
                </button>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Keep current status
                </button>
              </div>
            </div>
          ) : (
            <div className="inline-actions">
              {(nextOrderStatuses[order.status] || []).map((status) => (
                <button
                  key={status}
                  className={`button ${status === "cancelled" ? "outline workspace-danger" : "primary"}`}
                  disabled={busy}
                  onClick={() => setPending(status)}
                >
                  {status === "cancelled"
                    ? "Cancel order"
                    : status === "preparing"
                      ? "Start preparing"
                      : status === "out-for-delivery"
                        ? "Mark out for delivery"
                        : "Mark delivered"}
                </button>
              ))}
              {!nextOrderStatuses[order.status]?.length && (
                <span className="workspace-subtle">
                  <Check size={15} />
                  No further fulfilment steps.
                </span>
              )}
            </div>
          )}
        </section>
        <OrderOperationsPanel reference={order.reference} />
        {can(role, "finance") && (
          <OrderFinancePanel reference={order.reference} onChange={refresh} />
        )}
      </div>
    </AdminDrawer>
  );
}
