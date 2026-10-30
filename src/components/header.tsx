"use client";
import { useStoreFormat } from "./store-format";
import { useLanguage } from "./language-provider";

import Link from "next/link";
import {
  ChevronDown,
  Heart,
  Leaf,
  MapPin,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Package,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cartTotals } from "@/lib/commerce";
import { useShop } from "./shop-provider";
import { CategorySidebar, Modal } from "./ui";
import { useAccount } from "./account-provider";
import { SmartSearch } from "./smart-search";
import { ListChecks } from "lucide-react";
import { MiniCart } from "./mini-cart";
import { isStaff } from "@/lib/management";
import { LanguageSwitcher } from "./language-provider";
import { BROWSER_DEMO, demoCity } from "@/lib/browser-demo/config";
export function Brand() {
  const { t } = useLanguage();
  const {
    settings: { profile },
  } = useShop();
  return (
    <Link href="/" className="brand" aria-label={`${profile.name} home`}>
      <span className="brand-symbol">
        <img src={profile.logoUrl} alt="" width={43} height={43} />
      </span>
      <span>
        <span className="brand-name">
          {profile.name === "FreshCart" ? (
            <>
              Fresh<span>Cart</span>
            </>
          ) : (
            profile.name
          )}
        </span>
        <small>{t(profile.tagline)}</small>
      </span>
    </Link>
  );
}
export function Header() {
  const { money } = useStoreFormat();
  const { t } = useLanguage();
  const { user } = useAccount();
  const { items, catalog, area, setArea, saved, settings, setMiniCartOpen } =
    useShop();
  const [locationOpen, setLocationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartTotals(items, catalog).subtotal;
  return (
    <>
      <div className="announcement">
        <span>
          <Leaf size={12} />
          {t("A fresher everyday starts here")}
        </span>
        <span>
          {t("Free delivery on orders of ")}
          {money(settings.freeDeliveryAt)}+
          <span className="announcement-dot">•</span>
          {t("Choose your delivery slot")}
        </span>
      </div>
      <header className="header">
        <div className="header-inner">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Open categories")}
          >
            <Menu />
          </button>
          <Brand />
          <button
            className="location-button"
            onClick={() => setLocationOpen(true)}
          >
            <MapPin size={25} />
            <span>
              <small>{t("Deliver to")}</small>
              <strong>
                {area}
                {!BROWSER_DEMO && `, ${settings.profile.city}`}
                <ChevronDown size={12} />
              </strong>
            </span>
          </button>
          <SmartSearch />
          <LanguageSwitcher />
          <div className="account-wrap">
            <button
              className="account-button"
              aria-label={t("My shopping account")}
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <UserRound size={26} />
              <span>
                <strong>
                  {user ? user.name.split(" ")[0] : t("My Account")}
                </strong>
                <small>
                  {t(
                    BROWSER_DEMO
                      ? "Browser demo"
                      : user
                        ? "Your shopping space"
                        : "Sign in / Register",
                  )}
                </small>
              </span>
              <ChevronDown size={12} />
            </button>
            {accountOpen && (
              <>
                <button
                  className="popover-dismiss"
                  onClick={() => setAccountOpen(false)}
                  aria-label={t("Close account menu")}
                />
                <div className="account-popover">
                  <strong>{t("Make yourself at home")}</strong>
                  <p>
                    {t(
                      BROWSER_DEMO
                        ? "Accounts are disabled. Use the fictional customer at checkout."
                        : user
                          ? "Your groceries and orders, together."
                          : "Sign in to save addresses and orders across devices.",
                    )}
                  </p>
                  <Link href="/account" onClick={() => setAccountOpen(false)}>
                    <UserRound size={17} />
                    {t(
                      BROWSER_DEMO
                        ? "About this demo"
                        : user
                          ? "Manage account"
                          : "Sign in / Create account",
                    )}
                  </Link>
                  {(BROWSER_DEMO || isStaff(user?.role)) && (
                    <Link href="/admin" onClick={() => setAccountOpen(false)}>
                      {t("Admin dashboard")}
                    </Link>
                  )}
                  <Link
                    href="/products?saved=true"
                    onClick={() => setAccountOpen(false)}
                  >
                    <Heart size={17} />
                    {t("Saved items ")}
                    <span>{saved.length}</span>
                  </Link>
                  <Link href="/cart" onClick={() => setAccountOpen(false)}>
                    <ShoppingCart size={17} />
                    {t("My shopping cart")}
                    <span>{count}</span>
                  </Link>
                  <Link href="/orders" onClick={() => setAccountOpen(false)}>
                    <Package size={17} />
                    {t("My orders")}
                  </Link>
                  <Link href="/lists" onClick={() => setAccountOpen(false)}>
                    <ListChecks size={17} />
                    {t("My shopping lists")}
                  </Link>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setMiniCartOpen(true)}
            className="header-cart"
            aria-label={t("Open basket, {count} items", { count })}
          >
            <span className="cart-icon">
              <ShoppingCart size={28} />
              <span className="cart-count">{count}</span>
            </span>
            <span>
              <strong>{t("My Cart")}</strong>
              <small>{money(subtotal)}</small>
            </span>
          </button>
        </div>
      </header>
      <MiniCart />
      {locationOpen && (
        <Modal
          title={t("Where should we deliver?")}
          onClose={() => setLocationOpen(false)}
        >
          <p className="modal-description">
            {t("Choose your area for fresh groceries, delivered to your door.")}
          </p>
          <div className="area-options">
            {settings.zones
              .filter((z) => z.enabled)
              .map((z) => z.name)
              .map((option) => (
                <button
                  key={option}
                  className={area === option ? "selected" : ""}
                  onClick={() => {
                    setArea(option);
                    setLocationOpen(false);
                  }}
                >
                  <MapPin size={20} />
                  <span>
                    <strong>{t(option)}</strong>
                    <small>
                      {BROWSER_DEMO
                        ? demoCity(option).timeZone
                        : settings.profile.city}{" "}
                      · {t("Delivery slots at checkout")}
                    </small>
                  </span>
                  {area === option && <span className="area-check">✓</span>}
                </button>
              ))}
          </div>
        </Modal>
      )}
      {mobileOpen && (
        <MobileDrawer onClose={() => setMobileOpen(false)}>
          <div className="drawer-panel">
            <div className="drawer-title">
              <Brand />
              <button
                className="icon-button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("Close categories")}
              >
                <X />
              </button>
            </div>
            <div
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a"))
                  setMobileOpen(false);
              }}
            >
              <CategorySidebar />
            </div>
          </div>
        </MobileDrawer>
      )}
    </>
  );
}

function MobileDrawer({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const focused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="mobile-drawer"
      aria-label={t("Grocery categories")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
