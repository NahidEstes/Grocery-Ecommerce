import { notFound } from "next/navigation";
import { loadCatalog } from "@/lib/api";
import { ProductDetails } from "@/components/product-details";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await loadCatalog()).find((p) => p.slug === slug);
  return {
    title: product?.name || "Product not found",
    description: product?.description,
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await loadCatalog()).find((p) => p.slug === slug);
  if (!product) notFound();
  return <ProductDetails key={product.id} product={product} />;
}
