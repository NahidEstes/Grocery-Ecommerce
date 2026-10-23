"use client";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowUpLeft, Search, ArrowRight } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useShop } from "./shop-provider";
import { searchProducts } from "@/lib/search";
import { money } from "@/lib/commerce";
import { ProductImage } from "./ui";

export function SmartSearch() {
  const { t } = useLanguage();
  const { catalog } = useShop();
  const router = useRouter(),
    path = usePathname();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  const root = useRef<HTMLFormElement>(null);
  const id = useId();
  const matches = useMemo(
    () => searchProducts(catalog, query, 6),
    [catalog, query],
  );
  const expanded = open && query.trim().length > 0;
  useEffect(() => {
    setOpen(false);
    setActive(-1);
  }, [path]);
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    setActive(-1);
    router.push(
      `/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    );
  }
  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((previous) =>
        matches.length
          ? (previous + (e.key === "ArrowDown" ? 1 : -1) + matches.length) %
            matches.length
          : -1,
      );
    }
    if (e.key === "Enter" && expanded && active >= 0 && matches[active]) {
      e.preventDefault();
      setOpen(false);
      router.push(`/products/${matches[active].slug}`);
    }
  }
  return (
    <form
      ref={root}
      className="search-form smart-search"
      role="search"
      onSubmit={submit}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Search size={19} />
      <input
        role="combobox"
        aria-label={t("Search groceries")}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? id : undefined}
        aria-activedescendant={
          expanded && active >= 0 && matches[active]
            ? `${id}-${active}`
            : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value.slice(0, 100));
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={keys}
        placeholder={t("Search groceries… আলু, milk, eggs")}
        autoComplete="off"
        maxLength={100}
      />
      <button type="submit" aria-label={t("Search")}>
        <Search size={22} />
      </button>
      {expanded && (
        <div className="search-suggestions">
          <div className="suggestion-heading">
            <span>{t("FRESH FINDS")}</span>
            <small>বাংলা / English</small>
          </div>
          <div id={id} role="listbox" aria-label={t("Suggested groceries")}>
            {matches.map((p, index) => (
              <Link
                role="option"
                id={`${id}-${index}`}
                aria-selected={active === index}
                key={p.id}
                className={`search-option ${active === index ? "active" : ""}`}
                href={`/products/${p.slug}`}
                onPointerMove={() => setActive(index)}
                onClick={() => setOpen(false)}
              >
                <ProductImage product={p} />
                <span>
                  <strong>{t(p.name)}</strong>
                  <small>
                    {t(p.unit)}
                    {t(p.stock < 1 ? " · Out of stock" : "")}
                  </small>
                </span>
                <b>{money(p.price)}</b>
                <ArrowUpLeft size={15} />
              </Link>
            ))}
          </div>
          {!matches.length && (
            <div className="search-empty">
              <Search size={23} />
              <strong>{t("No matching groceries yet")}</strong>
              <span>{t("Try another name, such as আলু, দুধ or apple.")}</span>
            </div>
          )}
          <Link
            className="all-search-results"
            href={`/products?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
          >
            {t("See all results for “")}
            {query.trim()}” <ArrowRight size={15} />
          </Link>
          <div className="search-keyboard-hint">
            {t("↑ ↓ to explore · Enter to open · Esc to close")}
          </div>
        </div>
      )}
    </form>
  );
}
