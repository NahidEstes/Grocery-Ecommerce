import { OrdersPage } from "@/components/order-pages";
import { DemoOrders } from "@/components/demo-orders";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
export const metadata = { title: "Your orders" };
export default function OrdersRoute() {
  return BROWSER_DEMO ? <DemoOrders /> : <OrdersPage />;
}
