import { OrderConfirmation } from "@/components/order-pages";
import { DemoOrders } from "@/components/demo-orders";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
export const metadata = { title: "Order confirmation" };
export default async function OrderRoute({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return BROWSER_DEMO ? (
    <DemoOrders reference={reference} />
  ) : (
    <OrderConfirmation reference={reference} />
  );
}
