import type { Metadata } from "next";
import { loadCatalog } from "@/lib/api";
import { ShopProvider } from "@/components/shop-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";
export const metadata: Metadata = {
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
        <ShopProvider catalog={catalog}>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <Header />
          <main id="main-content">{children}</main>
          <Footer />
        </ShopProvider>
      </body>
    </html>
  );
}
