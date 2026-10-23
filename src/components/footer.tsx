"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { ArrowUpRight, Leaf } from "lucide-react";
import { Brand } from "./header";
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="footer">
      <div>
        <Brand />
        <p>
          {t("A little freshness goes a long way.")}
          <br />
          {t("Good groceries, delivered with care.")}
        </p>
      </div>
      <div className="footer-links">
        <Link href="/products">
          {t("Shop all groceries")}
          <ArrowUpRight size={14} />
        </Link>
        <Link href="/products?offers=true">
          {t("Today’s offers")}
          <ArrowUpRight size={14} />
        </Link>
        <Link href="/cart">
          {t("Your shopping cart")}
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="footer-note">
        <span>
          <Leaf size={15} />
          {t("Fresh choices. Brighter days.")}
        </span>
        <small>
          © {new Date().getFullYear()}
          {t(" FreshCart. Made for your everyday.")}
        </small>
      </div>
    </footer>
  );
}
