import { AdminPage } from "@/components/admin-page";
import { DemoAdmin } from "@/components/demo-admin";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
export const metadata = {
  title: "Store manager",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return BROWSER_DEMO ? (
    <DemoAdmin initialSection={section} />
  ) : (
    <AdminPage initialSection={section} />
  );
}
