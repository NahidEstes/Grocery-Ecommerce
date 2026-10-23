import { AdminPage } from "@/components/admin-page";
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
  return <AdminPage initialSection={section} />;
}
