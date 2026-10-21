import { ShoppingListsPage } from "@/components/shopping-lists";
export const metadata = {
  title: "Your shopping lists",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ShoppingListsPage />;
}
