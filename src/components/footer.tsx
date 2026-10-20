import Link from "next/link";
import { ArrowUpRight, Leaf } from "lucide-react";
import { Brand } from "./header";
export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Brand />
        <p>
          A little freshness goes a long way.
          <br />
          Good groceries, delivered with care.
        </p>
      </div>
      <div className="footer-links">
        <Link href="/products">
          Shop all groceries
          <ArrowUpRight size={14} />
        </Link>
        <Link href="/products?offers=true">
          Today’s offers
          <ArrowUpRight size={14} />
        </Link>
        <Link href="/cart">
          Your shopping cart
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="footer-note">
        <span>
          <Leaf size={15} />
          Fresh choices. Brighter days.
        </span>
        <small>
          © {new Date().getFullYear()} FreshCart. Made for your everyday.
        </small>
      </div>
    </footer>
  );
}
