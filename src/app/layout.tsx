import type { Metadata } from "next";
import { loadCatalog } from "@/lib/api";
import { ShopProvider } from "@/components/shop-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AccountProvider } from "@/components/account-provider";
import { MobileNavigation } from "@/components/storefront-extras";
import { ShoppingProvider } from "@/components/shopping-provider";
import "./globals.css";
import "./checkout.css";
import "./enhancements.css";
import "./shopping.css";
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: {
    default: "FreshCart — Good food. Brighter days.",
    template: "%s | FreshCart",
  },
  description:
    "Fresh groceries and everyday essentials, delivered with care in Dhaka. Shop fresh fruit, vegetables, dairy, bakery and pantry favourites.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const catalog = await loadCatalog();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AccountProvider>
          <ShopProvider catalog={catalog}>
            <ShoppingProvider>
              <a className="skip-link" href="#main-content">
                Skip to content
              </a>
              <Header />
              <main id="main-content">{children}</main>
              <Footer />
              <MobileNavigation />
            </ShoppingProvider>
          </ShopProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
