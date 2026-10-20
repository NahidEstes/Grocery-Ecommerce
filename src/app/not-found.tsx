import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
export default function NotFound() {
  return (
    <div className="page-container empty-state">
      <ShoppingBasket size={50} />
      <h1>This shelf is empty.</h1>
      <p>
        We couldn’t find that page. There’s plenty of fresh goodness waiting in
        the shop.
      </p>
      <Link className="button primary" href="/products">
        Back to groceries
      </Link>
    </div>
  );
}
