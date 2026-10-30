"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import type { Order } from "@/lib/orders";
import type { OrderFinance } from "@/lib/finance";
import { currencyText } from "@/lib/store-profile";
export function OrderFinancePanel(props: {
  reference: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="surface-card"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Payment reconciliation & external refunds</summary>
      {open && <OrderFinanceEditor {...props} />}
    </details>
  );
}
function OrderFinanceEditor({
  reference,
  onChange,
}: {
  reference: string;
  onChange: () => void;
}) {
  const [data, setData] = useState<{
      order: Order;
      finance: OrderFinance;
      refunded: number;
    }>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(await api(`/admin/orders/${reference}/finance`));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [reference]);
  // Keep the same ID if a successful response is lost. A changed form is a new action.
  const [attempt, setAttempt] = useState<{ body: string; id: string }>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data || busy) return;
    const form = new FormData(e.currentTarget);
    const body = JSON.stringify({
      version: data.finance.version,
      kind: form.get("kind"),
      amount: Number(form.get("amount")),
      method: form.get("method"),
      reference: form.get("reference"),
      note: form.get("note"),
    });
    const id = attempt?.body === body ? attempt.id : crypto.randomUUID();
    setAttempt({ body, id });
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/orders/${reference}/finance`, {
        method: "POST",
        body: JSON.stringify({ ...JSON.parse(body), id }),
      });
      await load();
      setNotice(
        "External record saved. No money was transferred by this site.",
      );
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(form: FormData) {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/orders/${reference}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          version: data.finance.version,
          stockRecovered: form.get("stockRecovered") === "on",
        }),
      });
      await load();
      setNotice("Order cancelled. Reserved stock was restored once.");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return <p role="status">{error || "Loading financial records…"}</p>;
  const amount = (v: number) => currencyText(v, data.order.currency || "BDT"),
    remaining = Math.round((data.finance.received - data.refunded) * 100) / 100;
  return (
    <section className="surface-card management-stack">
      <h3>Payment reconciliation & external refunds</h3>
      <p>
        This records money already received or refunded outside this site. It
        does not transfer money. After delivery, use an approved return in
        Returns & refunds.
      </p>
      <p>
        Received: <strong>{amount(data.finance.received)}</strong> · Refunded:{" "}
        <strong>{amount(data.refunded)}</strong> · Remaining:{" "}
        <strong>{amount(remaining)}</strong> ·{" "}
        {data.finance.reconciled ? "Reconciled" : "Review required"}
      </p>
      {data.order.status !== "delivered" && (
        <form className="enhance-form" onSubmit={submit}>
          <div className="form-grid">
            <label>
              Record type
              <select name="kind">
                <option value="refund">Externally completed refund</option>
                <option value="reconciliation">
                  Reconcile amount received
                </option>
              </select>
            </label>
            <label>
              Amount ({data.order.currency || "BDT"})
              <input
                name="amount"
                type="number"
                min="0"
                max={data.order.total}
                step="0.01"
                required
              />
            </label>
            <label>
              External method
              <input
                name="method"
                maxLength={80}
                minLength={2}
                placeholder="Bank / bKash / gateway portal"
                required
              />
            </label>
            <label>
              External transaction reference
              <input name="reference" maxLength={150} minLength={3} required />
            </label>
          </div>
          <label>
            Evidence / reason
            <textarea name="note" minLength={5} maxLength={1000} required />
          </label>
          <button disabled={busy} className="button outline">
            Record completed external action
          </button>
        </form>
      )}
      {!["delivered", "cancelled"].includes(data.order.status) && (
        <form action={cancel}>
          <label className="check-label">
            <input
              type="checkbox"
              name="stockRecovered"
              required={data.order.status === "out-for-delivery"}
            />{" "}
            Goods physically recovered (required after dispatch)
          </label>
          <button
            className="button primary"
            disabled={
              busy ||
              !data.finance.reconciled ||
              (remaining !== 0 &&
                ["paid", "review"].includes(data.order.paymentStatus || ""))
            }
          >
            Cancel after reconciliation
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <ol>
        {data.finance.events.map((event) => (
          <li key={event.id}>
            <strong>
              {event.kind} · {amount(event.amount)}
            </strong>{" "}
            — {event.method} / {event.reference}
            <br />
            {event.staffName} ·{" "}
            {new Date(event.at).toLocaleString("en", {
              timeZone: data.order.timeZone || "Asia/Dhaka",
            })}
            <p>{event.note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
