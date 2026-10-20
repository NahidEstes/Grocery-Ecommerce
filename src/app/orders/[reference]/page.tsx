import { OrderConfirmation } from "@/components/order-pages";
export const metadata = { title: "Order confirmation" };
export default async function OrderRoute({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <OrderConfirmation reference={reference} />;
}
