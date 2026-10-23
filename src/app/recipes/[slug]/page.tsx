import { notFound } from "next/navigation";
import { loadRecipes } from "@/lib/api";
import { RecipeDetails } from "@/components/recipes";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipes = await loadRecipes();
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
  const recipes = await loadRecipes();
  const recipe = recipes.find((r) => r.slug === slug);
  if (!recipe) notFound();
  return <RecipeDetails key={recipe.slug} recipe={recipe} />;
}
