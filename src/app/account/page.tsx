import { AccountPage } from "@/components/account-page";
import { DemoAccount } from "@/components/browser-demo";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
export const metadata = { title: "My account" };
export default function Page() {
  return BROWSER_DEMO ? <DemoAccount /> : <AccountPage />;
}
