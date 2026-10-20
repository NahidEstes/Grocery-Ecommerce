"use client";
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Beef,
  BottleWine,
  ChevronRight,
  Croissant,
  CupSoda,
  Grid2X2,
  Heart,
  House,
  Leaf,
  Milk,
  Minus,
  PackageCheck,
  PawPrint,
  Plus,
  ShieldCheck,
  ShoppingBasket,
  Snowflake,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { categories, type Product } from "@/lib/catalog";
import { money } from "@/lib/commerce";
import { useShop } from "./shop-provider";

const icons: Record<string, typeof Leaf> = {
  leaf: Leaf,
  milk: Milk,
  beef: Beef,
  croissant: Croissant,
  jar: ShoppingBasket,
  cup: CupSoda,
  snow: Snowflake,
  bottle: BottleWine,
  house: House,
  baby: Baby,
  heart: Heart,
  paw: PawPrint,
};
export function CategorySidebar({ active = "" }: { active?: string }) {
  return (
    <aside className="category-sidebar" aria-label="Grocery categories">
      <Link href="/products" className="all-categories">
        <Grid2X2 size={20} />
        All Categories
      </Link>
      <nav>
        {categories.map((category) => {
          const Icon = icons[category.icon];
          return (
            <Link
              key={category.slug}
              href={`/products?category=${category.slug}`}
              className={
                active === category.slug
                  ? "category-link active"
                  : "category-link"
              }
            >
              <Icon size={21} color={category.color} strokeWidth={2.1} />
              <span>{category.name}</span>
              <ChevronRight size={14} />
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <Leaf size={25} />
        <strong>
          A little fresher.
          <br />
          Every single day.
        </strong>
        <p>Good food for your everyday.</p>
      </div>
    </aside>
  );
}
export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const row = Math.floor(product.atlas / 4);
  return (
    <div
      role="img"
      aria-label={product.name}
      className={`product-image ${className}`}
      style={{
        backgroundPosition: `${((product.atlas % 4) * 100) / 3}% ${row === 2 ? 96 : row * 50}%`,
        clipPath: row === 1 ? "inset(0 0 8% 0)" : undefined,
      }}
    />
  );
}
export function QuantityControl({
  quantity,
  onChange,
  max = 99,
  label = "Quantity",
  compact = false,
}: {
  quantity: number;
  onChange: (value: number) => void;
  max?: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`quantity-control ${compact ? "compact" : ""}`}
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={quantity <= 0}
        onClick={() => onChange(quantity - 1)}
      >
        <Minus size={15} />
      </button>
      <span aria-live="polite">{quantity}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const { items, addItem, setQuantity, saved, toggleSaved } = useShop();
  const quantity =
    items.find((item) => item.productId === product.id)?.quantity || 0;
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  return (
    <article className="product-card">
      <div className="product-visual">
        {discount > 0 && (
          <span className="discount-badge">{discount}% OFF</span>
        )}
        <button
          className={`save-product ${saved.includes(product.id) ? "saved" : ""}`}
          aria-label={`${saved.includes(product.id) ? "Unsave" : "Save"} ${product.name}`}
          aria-pressed={saved.includes(product.id)}
          onClick={() => toggleSaved(product.id)}
        >
          <Heart
            size={17}
            fill={saved.includes(product.id) ? "currentColor" : "none"}
          />
        </button>
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
        >
          <ProductImage product={product} />
        </Link>
      </div>
      <Link className="product-name" href={`/products/${product.slug}`}>
        {product.name}
      </Link>
      <p className="product-unit">{product.unit}</p>
      <div className="product-card-bottom">
        <div className="product-prices">
          <strong>{money(product.price)}</strong>
          {product.originalPrice && <del>{money(product.originalPrice)}</del>}
        </div>
        {quantity > 0 ? (
          <QuantityControl
            compact
            quantity={quantity}
            max={product.stock}
            label={product.name}
            onChange={(value) => setQuantity(product.id, value)}
          />
        ) : (
          <button
            className="add-product"
            onClick={() => addItem(product.id)}
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus size={24} />
          </button>
        )}
      </div>
    </article>
  );
}
export function Benefits() {
  return (
    <section className="benefits" aria-label="Shopping benefits">
      {[
        { icon: Truck, title: "Free delivery", text: "On orders of ৳1,000+" },
        {
          icon: PackageCheck,
          title: "Same-day delivery",
          text: "Freshness at your doorstep",
        },
        {
          icon: Leaf,
          title: "Freshness, guaranteed",
          text: "Picked with a little extra care",
        },
        {
          icon: ShieldCheck,
          title: "Secure shopping",
          text: "Cash on delivery available",
        },
      ].map(({ icon: Icon, title, text }) => (
        <div key={title}>
          <Icon size={31} />
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </section>
  );
}
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      {items.map((item, index) => (
        <span key={index}>
          <ChevronRight size={14} />
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
export function SectionTitle({
  title,
  subtitle,
  href,
  linkText = "View all",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {href && (
        <Link href={href}>
          {linkText}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const focused = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
