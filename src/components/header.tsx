"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Heart,
  Leaf,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cartTotals, money } from "@/lib/commerce";
import { useShop } from "./shop-provider";
import { CategorySidebar, Modal } from "./ui";
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
  const { items, catalog, area, setArea, saved } = useShop();
  const [locationOpen, setLocationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartTotals(items, catalog).subtotal;
  function search(event: FormEvent) {
    event.preventDefault();
    router.push(
      `/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    );
  }
  return (
    <>
      <div className="announcement">
        <span>
          <Leaf size={12} />A fresher everyday starts here
        </span>
        <span>
          Free delivery on orders of ৳1,000+
          <span className="announcement-dot">•</span>Same-day delivery in Dhaka
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
          <form className="search-form" role="search" onSubmit={search}>
            <Search size={19} />
            <input
              aria-label="Search groceries"
              placeholder="Search for groceries, fruits, snacks, and more…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" aria-label="Search">
              <Search size={22} />
            </button>
          </form>
          <div className="account-wrap">
            <button
              className="account-button"
              aria-label="My shopping account"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <UserRound size={26} />
              <span>
                <strong>My Account</strong>
                <small>Your shopping space</small>
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
                  <p>Your favourites and basket, saved on this device.</p>
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
                </div>
              </>
            )}
          </div>
          <Link
            href="/cart"
            className="header-cart"
            aria-label={`Shopping cart, ${count} items`}
          >
            <span className="cart-icon">
              <ShoppingCart size={28} />
              <span className="cart-count">{count}</span>
            </span>
            <span>
              <strong>My Cart</strong>
              <small>{money(subtotal)}</small>
            </span>
          </Link>
        </div>
      </header>
      {locationOpen && (
        <Modal
          title="Where should we deliver?"
          onClose={() => setLocationOpen(false)}
        >
          <p className="modal-description">
            Choose your area for fresh groceries, delivered to your door.
          </p>
          <div className="area-options">
            {["Dhanmondi", "Mirpur", "Uttara", "Gulshan"].map((option) => (
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
                  <small>Dhaka · Same-day delivery</small>
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
