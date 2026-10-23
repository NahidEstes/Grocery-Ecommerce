"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "./account-provider";
import { can } from "@/lib/management";
import { api } from "@/lib/client-api";
import { money } from "@/lib/commerce";
import { formatDelivery, orderTime, type Order } from "@/lib/orders";
export function OrderPrint({ reference }: { reference: string }) {
  const { user, ready } = useAccount(),
    params = useSearchParams(),
    packing = params.get("kind") === "packing";
  const [order, setOrder] = useState<Order>(),
    [error, setError] = useState("");
  useEffect(() => {
    if (ready && can(user?.role, "orders"))
      void api<{ order: Order }>(`/admin/orders/${reference}/print`)
        .then((r) => setOrder(r.order))
        .catch((e) => setError(e.message));
  }, [ready, user?.id, user?.role, reference]);
  if (!ready) return <p>Checking staff access…</p>;
  if (!can(user?.role, "orders"))
    return (
      <p className="page-container">
        Sign in with order-management access to print this order.
      </p>
    );
  return (
    <div className="page-container print-order">
      <div className="print-controls">
        <button
          className="button primary"
          disabled={!order}
          onClick={() => window.print()}
        >
          Print {packing ? "packing list" : "invoice"}
        </button>
        <p>Your browser’s print dialog lets you print or save as PDF.</p>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {order && (
        <article className="surface-card">
          <div className="card-title">
            <div>
              <h1>FreshCart</h1>
              <h2>{packing ? "Packing list" : "Order invoice"}</h2>
            </div>
            <div>
              <strong>{order.reference}</strong>
              <p>{orderTime(order.createdAt)}</p>
              <p>
                {order.mode === "demo"
                  ? "DEMO · NO REAL DELIVERY"
                  : order.sandbox
                    ? "SANDBOX ORDER"
                    : ""}
              </p>
            </div>
          </div>
          <p>
            <strong>{order.customer.name}</strong>
            <br />
            {order.customer.phone}
            <br />
            {order.customer.address}, {order.customer.area}
          </p>
          <p>{formatDelivery(order.deliverySelection)}</p>
          {order.instructions && <p>Delivery note: {order.instructions}</p>}
          <table className="admin-table">
            <thead>
              <tr>
                {packing && <th>Checked</th>}
                <th>Item</th>
                <th>Pack</th>
                <th>Quantity</th>
                {!packing && (
                  <>
                    <th>Unit price</th>
                    <th>Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.productId}>
                  {packing && <td>□</td>}
                  <td>{i.name}</td>
                  <td>{i.unit}</td>
                  <td>{i.quantity}</td>
                  {!packing && (
                    <>
                      <td>{money(i.price)}</td>
                      <td>{money(i.price * i.quantity)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!packing && (
            <dl className="invoice-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>−{money(order.discount)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{money(order.delivery)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{money(order.total)}</dd>
              </div>
            </dl>
          )}
          <p>
            {order.payment === "online"
              ? `Online payment: ${order.paymentStatus}`
              : "Cash on delivery"}{" "}
            · Order status: {order.status}
          </p>
          <small>
            Order summary document. It does not certify payment collection or
            tax registration.
          </small>
        </article>
      )}
    </div>
  );
}
