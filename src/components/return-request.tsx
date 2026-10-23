"use client";
import { useLanguage } from "./language-provider";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { Order } from "@/lib/orders";
import type { ReturnRequest } from "@/lib/management";
import { money } from "@/lib/commerce";
export function CustomerReturns({
  order,
  token,
}: {
  order: Order;
  token: string;
}) {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<
      Pick<ReturnRequest, "id" | "status" | "reason" | "amount" | "items">[]
    >([]),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const base = `/orders/${order.reference}/returns`;
  async function load() {
    setRequests(
      (await api<{ returns: typeof requests }>(base, { headers })).returns,
    );
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [order.reference, token]);
  if (order.status !== "delivered") return null;
  return (
    <section className="surface-card customer-returns">
      <span className="eyebrow">{t("CARE AFTER YOUR DELIVERY")}</span>
      <h2>{t("Report a return or refund request")}</h2>
      <p>
        {t(
          "Choose the affected packs and tell us what happened. The store will review eligibility and contact you about the resolution.",
        )}
      </p>
      {requests.map((r) => (
        <article className="customer-return-status" key={r.id}>
          <strong>{r.status.replaceAll("-", " ")}</strong>
          <p>{r.reason}</p>
          <small>
            {t("Product value under review: ")}
            {money(r.amount)}
          </small>
        </article>
      ))}
      <form
        className="enhance-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            items = Object.entries(quantities)
              .filter(([, q]) => q > 0)
              .map(([productId, quantity]) => ({ productId, quantity }));
          if (!items.length) {
            setError("Choose at least one affected product.");
            return;
          }
          setBusy(true);
          setError("");
          setSuccess("");
          try {
            await api(base, {
              method: "POST",
              headers,
              body: JSON.stringify({
                reason: String(new FormData(form).get("reason")),
                items,
              }),
            });
            await load();
            setQuantities({});
            form.reset();
            setSuccess(
              "Your request was received. A refund is confirmed only after the store reviews and processes it.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="return-product-options">
          {order.items.map((item) => {
            const requested = requests
                .filter((r) => r.status !== "rejected")
                .flatMap((r) => r.items)
                .filter((i) => i.productId === item.productId)
                .reduce((n, i) => n + i.quantity, 0),
              remaining = item.quantity - requested;
            return (
              <label key={item.productId}>
                {t(item.name)} · {t(item.unit)}
                <select
                  aria-label={`Return quantity for ${item.name}`}
                  value={quantities[item.productId] || 0}
                  disabled={!remaining || busy}
                  onChange={(e) =>
                    setQuantities((p) => ({
                      ...p,
                      [item.productId]: Number(e.target.value),
                    }))
                  }
                >
                  {Array.from(
                    { length: Math.max(0, remaining) + 1 },
                    (_, n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? "No packs selected"
                          : `${n} pack${n > 1 ? "s" : ""}`}
                      </option>
                    ),
                  )}
                </select>
              </label>
            );
          })}
        </div>
        <label>
          {t("What happened?")}
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            placeholder={t(
              "Tell us which items were affected and what was wrong…",
            )}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        {success && (
          <p className="success-message" role="status">
            {success}
          </p>
        )}
        <button className="button outline" disabled={busy}>
          {t(busy ? "Sending request…" : "Submit return request")}
        </button>
      </form>
    </section>
  );
}
