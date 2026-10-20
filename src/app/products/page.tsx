import { Suspense } from "react";
import { ProductListing } from "@/components/product-listing";
export const metadata = { title: "Shop fresh groceries" };
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container loading-state">
          Picking something fresh for you…
        </div>
      }
    >
      <ProductListing />
    </Suspense>
  );
}
