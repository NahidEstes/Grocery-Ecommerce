"use client";
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
import { cartTotals, money } from "@/lib/commerce";
import { useShop } from "./shop-provider";
import { CategorySidebar, Modal } from "./ui";
import { useAccount } from "./account-provider";
import { SmartSearch } from "./smart-search";
import { ListChecks } from "lucide-react";
import { MiniCart } from "./mini-cart";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="FreshCart home">
      <span className="brand-symbol">
        <ShoppingBag size={33} strokeWidth={2.5} />
        <Leaf className="brand-leaf" size={20} fill="currentColor" />
      </span>
      <span>
        <span className="brand-name">
          Fresh<span>Cart</span>
        </span>
        <small>Good food. Brighter days.</small>
      </span>
    </Link>
  );
}
export function Header() {
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
          <Leaf size={12} />A fresher everyday starts here
        </span>
        <span>
          Free delivery on orders of {money(settings.freeDeliveryAt)}+
          <span className="announcement-dot">•</span>Choose your delivery slot
        </span>
      </div>
      <header className="header">
        <div className="header-inner">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open categories"
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
              <small>Deliver to</small>
              <strong>
                {area}, Dhaka
                <ChevronDown size={12} />
              </strong>
            </span>
          </button>
          <SmartSearch />
          <div className="account-wrap">
            <button
              className="account-button"
              aria-label="My shopping account"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <UserRound size={26} />
              <span>
                <strong>{user ? user.name.split(" ")[0] : "My Account"}</strong>
                <small>
                  {user ? "Your shopping space" : "Sign in / Register"}
                </small>
              </span>
              <ChevronDown size={12} />
            </button>
            {accountOpen && (
              <>
                <button
                  className="popover-dismiss"
                  onClick={() => setAccountOpen(false)}
                  aria-label="Close account menu"
                />
                <div className="account-popover">
                  <strong>Make yourself at home</strong>
                  <p>
                    {user
                      ? "Your groceries and orders, together."
                      : "Sign in to save addresses and orders across devices."}
                  </p>
                  <Link href="/account" onClick={() => setAccountOpen(false)}>
                    <UserRound size={17} />
                    {user ? "Manage account" : "Sign in / Create account"}
                  </Link>
                  {user?.role === "admin" && (
                    <Link href="/admin" onClick={() => setAccountOpen(false)}>
                      Admin dashboard
                    </Link>
                  )}
                  <Link
                    href="/products?saved=true"
                    onClick={() => setAccountOpen(false)}
                  >
                    <Heart size={17} />
                    Saved items <span>{saved.length}</span>
                  </Link>
                  <Link href="/cart" onClick={() => setAccountOpen(false)}>
                    <ShoppingCart size={17} />
                    My shopping cart<span>{count}</span>
                  </Link>
                  <Link href="/orders" onClick={() => setAccountOpen(false)}>
                    <Package size={17} />
                    My orders
                  </Link>
                  <Link href="/lists" onClick={() => setAccountOpen(false)}>
                    <ListChecks size={17} />
                    My shopping lists
                  </Link>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setMiniCartOpen(true)}
            className="header-cart"
            aria-label={`Open basket, ${count} items`}
          >
            <span className="cart-icon">
              <ShoppingCart size={28} />
              <span className="cart-count">{count}</span>
            </span>
            <span>
              <strong>My Cart</strong>
              <small>{money(subtotal)}</small>
            </span>
          </button>
        </div>
      </header>
      <MiniCart />
      {locationOpen && (
        <Modal
          title="Where should we deliver?"
          onClose={() => setLocationOpen(false)}
        >
          <p className="modal-description">
            Choose your area for fresh groceries, delivered to your door.
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
                    <strong>{option}</strong>
                    <small>Dhaka · Delivery slots at checkout</small>
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
                aria-label="Close categories"
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
      aria-label="Grocery categories"
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
