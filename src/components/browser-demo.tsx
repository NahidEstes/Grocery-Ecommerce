"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
import { useShop } from "./shop-provider";
import { resetDemo, writeDemo } from "@/lib/browser-demo/storage";
import { BROWSER_DEMO, demoCities } from "@/lib/browser-demo/config";

export function DemoBanner() {
  const { t } = useLanguage();
  const { clearCart, area, setArea, saved, toggleSaved, ready } = useShop();
  const [durable, setDurable] = useState(true);
  useEffect(() => {
    if (!BROWSER_DEMO) return;
    const failed = () => setDurable(false);
    window.addEventListener("freshcart-demo-storage-unavailable", failed);
    setDurable(writeDemo("storage-check", true));
    return () =>
      window.removeEventListener("freshcart-demo-storage-unavailable", failed);
  }, []);
  if (!BROWSER_DEMO) return null;
  return (
    <aside className="browser-demo-banner" aria-label="Interactive demo">
      <div>
        <strong>{t("Interactive demo")} · USA / USD</strong>
        <span>{t("Demo only — no real payment or delivery.")}</span>
        <small>
          {t("Fictional sample prices. No personal information needed.")}
        </small>
      </div>
      <nav aria-label={t("Demo tools")}>
        <label className="demo-city-picker">
          {t("City")}
          <select
            aria-label={t("Demo delivery city")}
            value={area}
            disabled={!ready}
            onChange={(event) => setArea(event.target.value)}
          >
            {demoCities.map((city) => (
              <option key={city.name}>{city.name}</option>
            ))}
          </select>
        </label>
        <Link href="/admin">{t("Read-only admin")}</Link>
        <Link href="/orders">{t("Demo receipts")}</Link>
        <button
          type="button"
          onClick={() => {
            clearCart();
            for (const id of saved) toggleSaved(id);
            setArea("New York, NY");
            resetDemo();
            window.dispatchEvent(new Event("freshcart-demo-reset"));
          }}
        >
          {t("Reset demo data")}
        </button>
      </nav>
      {!durable && (
        <p role="status">
          {t(
            "Browser storage is unavailable. Shopping works for this session; receipts and cart cannot survive a reload.",
          )}
        </p>
      )}
    </aside>
  );
}
export function DemoAccount() {
  const { t } = useLanguage();
  return (
    <div className="page-container">
      <section className="surface-card demo-panel">
        <h1>{t("Browser demo")}</h1>
        <p>
          {t(
            "Accounts, registration, password resets, email and payments are disabled in this demo.",
          )}
        </p>
        <p>
          {t(
            "Use the fictional customer at checkout. Your demo receipts stay in this browser only.",
          )}
        </p>
        <Link className="button primary" href="/products">
          {t("Continue shopping")}
        </Link>
        <Link className="button outline" href="/admin">
          {t("Read-only admin")}
        </Link>
      </section>
    </div>
  );
}
