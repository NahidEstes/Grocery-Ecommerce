import { Suspense } from "react";
import { OrderPrint } from "@/components/order-print";
export const metadata = {
  title: "Print order",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return (
    <Suspense fallback={<p>Opening document…</p>}>
      <OrderPrint reference={reference} />
    </Suspense>
  );
}
