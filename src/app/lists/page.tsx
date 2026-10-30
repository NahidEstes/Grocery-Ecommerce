import { ShoppingListsPage } from "@/components/shopping-lists";
import { DemoAccount } from "@/components/browser-demo";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
export const metadata = {
  title: "Your shopping lists",
  robots: { index: false, follow: false },
};
export default function Page() {
  return BROWSER_DEMO ? <DemoAccount /> : <ShoppingListsPage />;
}
