import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, normalizeLocale } from "@/lib/i18n";
import {
  LanguageProvider,
  SkipToContent,
} from "@/components/language-provider";
import { loadCatalog, loadStorefront } from "@/lib/api";
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
import "./management.css";
import "./language.css";
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
  const [catalog, storefront] = await Promise.all([
    loadCatalog(),
    loadStorefront(),
  ]);
  const locale = normalizeLocale((await cookies()).get(LANGUAGE_COOKIE)?.value);
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <LanguageProvider initialLocale={locale}>
          <AccountProvider>
            <ShopProvider
              catalog={catalog}
              initialContent={storefront.content}
              initialRecipes={storefront.recipes}
            >
              <ShoppingProvider>
                <SkipToContent />
                <Header />
                <main id="main-content">{children}</main>
                <Footer />
                <MobileNavigation />
              </ShoppingProvider>
            </ShopProvider>
          </AccountProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
