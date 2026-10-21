import type { Product } from "./catalog";
export type RecipeIngredient = {
  id: string;
  name: string;
  productId?: string;
  amount?: number;
  measureUnit?: "kg" | "litre" | "piece";
  pantry?: string;
};
export type Recipe = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  minutes: number;
  servings: number;
  atlas: number[];
  ingredients: RecipeIngredient[];
  steps: string[];
  allergenNote: string;
};
export const recipes: Recipe[] = [
  {
    slug: "garden-crunch-salad",
    title: "Garden crunch salad",
    eyebrow: "FRESH & SIMPLE",
    description:
      "A bright bowl of cucumber, tomato and carrot for an easy side dish.",
    minutes: 10,
    servings: 2,
    atlas: [6, 2, 3],
    ingredients: [
      {
        id: "cucumber",
        name: "Cucumber",
        productId: "cucumber",
        amount: 0.25,
        measureUnit: "kg",
      },
      {
        id: "tomato",
        name: "Tomato",
        productId: "tomato",
        amount: 0.25,
        measureUnit: "kg",
      },
      {
        id: "carrot",
        name: "Carrot",
        productId: "carrot",
        amount: 0.1,
        measureUnit: "kg",
      },
      {
        id: "dressing",
        name: "Lemon juice, salt & pepper",
        pantry: "To taste · from your pantry",
      },
    ],
    steps: [
      "Wash the vegetables thoroughly. Peel the carrot if you prefer.",
      "Slice the cucumber and tomato, then grate or finely slice the carrot.",
      "Toss together with a little lemon juice, salt and pepper. Serve freshly prepared.",
    ],
    allergenNote: "Check any dressing or seasoning you use for allergens.",
  },
  {
    slug: "golden-breakfast-toast",
    title: "Golden breakfast toast",
    eyebrow: "A BRIGHTER BREAKFAST",
    description: "Warm, golden eggy toast for a comforting start to the day.",
    minutes: 15,
    servings: 2,
    atlas: [9, 10, 8],
    ingredients: [
      {
        id: "bread",
        name: "Whole wheat bread",
        productId: "bread",
        amount: 0.12,
        measureUnit: "kg",
      },
      {
        id: "eggs",
        name: "Eggs",
        productId: "eggs",
        amount: 2,
        measureUnit: "piece",
      },
      {
        id: "milk",
        name: "Milk",
        productId: "milk",
        amount: 0.1,
        measureUnit: "litre",
      },
      {
        id: "oil",
        name: "Cooking oil",
        productId: "oil",
        amount: 0.01,
        measureUnit: "litre",
      },
      {
        id: "seasoning",
        name: "Salt or cinnamon",
        pantry: "A little, to taste · from your pantry",
      },
    ],
    steps: [
      "Whisk the eggs and milk together in a shallow bowl. Add your preferred seasoning.",
      "Warm a little oil in a frying pan over medium heat. Dip the bread briefly into the egg mixture.",
      "Cook on both sides until golden and the egg mixture is fully cooked through. Serve warm.",
    ],
    allergenNote:
      "Uses wheat, eggs, milk and soyabean oil. Check the actual packs for allergen details.",
  },
  {
    slug: "potato-egg-skillet",
    title: "Potato & egg skillet",
    eyebrow: "EVERYDAY COMFORT",
    description:
      "Tender potatoes, tomatoes and eggs, together in one warming pan.",
    minutes: 25,
    servings: 2,
    atlas: [7, 10, 2],
    ingredients: [
      {
        id: "potato",
        name: "Potatoes",
        productId: "potato",
        amount: 0.5,
        measureUnit: "kg",
      },
      {
        id: "eggs",
        name: "Eggs",
        productId: "eggs",
        amount: 2,
        measureUnit: "piece",
      },
      {
        id: "tomato",
        name: "Tomatoes",
        productId: "tomato",
        amount: 0.2,
        measureUnit: "kg",
      },
      {
        id: "oil",
        name: "Cooking oil",
        productId: "oil",
        amount: 0.015,
        measureUnit: "litre",
      },
      {
        id: "spices",
        name: "Salt & your favourite spices",
        pantry: "To taste · from your pantry",
      },
    ],
    steps: [
      "Wash the potatoes and tomatoes. Dice the potatoes into small, even pieces.",
      "Warm the oil in a pan and cook the potatoes, stirring and adding a splash of water if needed, until tender. Add chopped tomatoes and seasoning.",
      "Make small spaces for the eggs. Cover and cook until both the whites and yolks are fully set. Serve hot.",
    ],
    allergenNote:
      "Uses eggs and soyabean oil. Check seasoning and product labels for other allergens.",
  },
];
export function ingredientAmount(
  ingredient: RecipeIngredient,
  servings: number,
  baseServings: number,
) {
  if (!ingredient.amount || !ingredient.measureUnit)
    return ingredient.pantry || "From your pantry";
  const amount = (ingredient.amount * servings) / baseServings;
  if (ingredient.measureUnit === "piece")
    return `${Number(amount.toFixed(2))} ${amount === 1 ? "piece" : "pieces"}`;
  return ingredient.measureUnit === "kg"
    ? `${Number((amount * 1000).toFixed(1))} g`
    : `${Number((amount * 1000).toFixed(1))} ml`;
}
export function ingredientPacks(
  ingredient: RecipeIngredient,
  product: Product | undefined,
  servings: number,
  baseServings: number,
) {
  if (
    !product ||
    !ingredient.amount ||
    !product.measure ||
    product.measureUnit !== ingredient.measureUnit
  )
    return null;
  return Math.max(
    1,
    Math.ceil(
      Number(
        (
          (ingredient.amount * servings) /
          baseServings /
          product.measure
        ).toFixed(8),
      ),
    ),
  );
}
