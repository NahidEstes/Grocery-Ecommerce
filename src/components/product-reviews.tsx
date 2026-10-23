"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Star } from "lucide-react";
import { useAccount } from "./account-provider";
import { useShop } from "./shop-provider";
import { api } from "@/lib/client-api";
import type { Order } from "@/lib/orders";
export function ProductReviews({ productIds }: { productIds: string[] }) {
  const { t } = useLanguage();
  const { user } = useAccount();
  const { reviews } = useShop();
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    const controller = new AbortController();
    api<{ orders: Order[] }>("/me/orders", { signal: controller.signal })
      .then((d) => setOrders(d.orders))
      .catch(() => {});
    return () => controller.abort();
  }, [user?.id]);
  const published = reviews.filter((r) => productIds.includes(r.productId));
  const eligible = orders.filter(
    (o) =>
      o.status === "delivered" &&
      o.mode === "mongodb" &&
      !o.sandbox &&
      o.items.some((i) => productIds.includes(i.productId)),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const [reference, productId] = String(form.get("purchase")).split("|");
    setBusy(true);
    setError("");
    try {
      const data = await api<{ message: string }>("/reviews", {
        method: "POST",
        body: JSON.stringify({
          reference,
          productId,
          rating: Number(form.get("rating")),
          text: form.get("text"),
        }),
      });
      setMessage(data.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="product-reviews surface-card">
      <div className="card-title">
        <div>
          <span className="eyebrow">{t("FROM REAL PURCHASES")}</span>
          <h2>{t("Customer reviews")}</h2>
        </div>
        <Star size={25} />
      </div>
      {published.length ? (
        <div className="review-grid">
          {published.map((r) => (
            <article key={r.id}>
              <span
                className="review-stars"
                aria-label={`${r.rating} out of 5`}
              >
                {"★".repeat(r.rating)}
              </span>
              <p>{t(r.text)}</p>
              <strong>{r.author}</strong>
              <small>
                <Check size={13} />
                {t(" Verified purchase")}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="quiet-empty">{t("No verified reviews yet.")}</p>
      )}
      {!user ? (
        <Link className="subtle-link" href="/account">
          {t("Sign in to review a delivered purchase")}
        </Link>
      ) : eligible.length && !message ? (
        <form className="enhance-form review-form" onSubmit={submit}>
          <h3>{t("Share your experience")}</h3>
          <div className="form-grid">
            <label>
              {t("Delivered purchase")}
              <select name="purchase">
                {eligible.flatMap((o) =>
                  o.items
                    .filter((i) => productIds.includes(i.productId))
                    .map((i) => (
                      <option
                        key={`${o.reference}-${i.productId}`}
                        value={`${o.reference}|${i.productId}`}
                      >
                        {o.reference} · {t(i.unit)}
                      </option>
                    )),
                )}
              </select>
            </label>
            <label>
              {t("Rating")}
              <select name="rating" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {t(" out of 5")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {t("Your review")}
            <textarea
              name="text"
              minLength={10}
              maxLength={1000}
              rows={3}
              required
            />
          </label>
          <button className="button primary" disabled={busy}>
            {t(busy ? "Submitting…" : "Submit review")}
          </button>
        </form>
      ) : (
        !message && (
          <p className="muted">
            {t("Reviews become available after a real order is delivered.")}
          </p>
        )
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
    </section>
  );
}
