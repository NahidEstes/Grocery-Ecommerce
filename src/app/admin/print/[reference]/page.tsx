import { Suspense } from "react";
import { OrderPrint } from "@/components/order-print";
import { DemoAdmin } from "@/components/demo-admin";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
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
  if (BROWSER_DEMO) return <DemoAdmin initialSection="orders" />;
  return (
    <Suspense fallback={<p>Opening document…</p>}>
      <OrderPrint reference={reference} />
    </Suspense>
  );
}
