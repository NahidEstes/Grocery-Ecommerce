import { notFound } from "next/navigation";
import { recipes } from "@/lib/recipes";
import { RecipeDetails } from "@/components/recipes";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: recipes.find((r) => r.slug === slug)?.title || "Recipe not found",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = recipes.find((r) => r.slug === slug);
  if (!recipe) notFound();
  return <RecipeDetails key={recipe.slug} recipe={recipe} />;
}
