import { CheckoutPage } from "@/components/checkout-page";
import { DemoCheckout } from "@/components/demo-checkout";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
export const metadata = { title: "Checkout" };
export default async function CheckoutRoute({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string }>;
}) {
  const query = await searchParams;
  if (BROWSER_DEMO)
    return (
      <DemoCheckout
        promo={query.promo?.toUpperCase() === "FRESH10" ? "FRESH10" : ""}
      />
    );
  return (
    <CheckoutPage
      promo={query.promo?.toUpperCase() === "FRESH10" ? "FRESH10" : ""}
    />
  );
}
