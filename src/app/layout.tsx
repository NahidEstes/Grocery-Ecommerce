import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
const dmSans = localFont({
  src: "../../public/fonts/dmsans.ttf",
  variable: "--font-latin",
  weight: "100 1000",
  display: "swap",
});
const bengali = localFont({
  src: "../../public/fonts/notosansbengali.ttf",
  variable: "--font-bengali",
  weight: "100 900",
  display: "swap",
  preload: false,
});

import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, normalizeLocale } from "@/lib/i18n";
import {
  LanguageProvider,
  SkipToContent,
} from "@/components/language-provider";
import { loadCatalog, loadStorefront } from "@/lib/api";
import { ShopProvider } from "@/components/shop-provider";

import { AccountProvider } from "@/components/account-provider";

import { ShoppingProvider } from "@/components/shopping-provider";
import "./globals.css";
import "./checkout.css";
import "./enhancements.css";
import "./shopping.css";
import "./management.css";
import "./language.css";
import "./operations.css";
import "./buyer-polish.css";
import "./browser-demo.css";
import "./admin-workspace.css";
import "./admin-products.css";
import { StoreFrame } from "@/components/store-frame";

export const viewport: Viewport = { themeColor: "#174d2a" };
export async function generateMetadata(): Promise<Metadata> {
  const {
    settings: { profile },
  } = await loadStorefront();
  return {
    applicationName: profile.name,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: profile.name,
    },
    icons: { apple: "/icons/freshcart-180.png" },
    referrer: "no-referrer",
    title: {
      default: `${profile.name} — ${profile.tagline}`,
      template: `%s | ${profile.name}`,
    },
    description: `${profile.tagline} Shop groceries in ${profile.city}.`,
  };
}
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
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${dmSans.variable} ${bengali.variable}`}
    >
      <body>
        <LanguageProvider initialLocale={locale}>
          <AccountProvider>
            <ShopProvider
              catalog={catalog}
              initialContent={storefront.content}
              initialRecipes={storefront.recipes}
              initialSettings={storefront.settings}
              initialMode={storefront.mode}
            >
              <ShoppingProvider>
                <SkipToContent />
                <StoreFrame>{children}</StoreFrame>
              </ShoppingProvider>
            </ShopProvider>
          </AccountProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
