import { CheckoutPage } from "@/components/checkout-page";
export const metadata = { title: "Checkout" };
export default async function CheckoutRoute({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string }>;
}) {
  const query = await searchParams;
  return (
    <CheckoutPage
      promo={query.promo?.toUpperCase() === "FRESH10" ? "FRESH10" : ""}
    />
  );
}
