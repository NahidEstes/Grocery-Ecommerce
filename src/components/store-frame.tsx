"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Footer } from "./footer";
import { PwaInstall } from "./pwa-install";
import { MobileNavigation } from "./storefront-extras";
import { DemoBanner } from "./browser-demo";

export function StoreFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <>
      <DemoBanner />
      {!admin && <Header />}
      <main id="main-content" className={admin ? "admin-route" : undefined}>
        {children}
      </main>
      {!admin && (
        <>
          <PwaInstall />
          <Footer />
          <MobileNavigation />
        </>
      )}
    </>
  );
}
