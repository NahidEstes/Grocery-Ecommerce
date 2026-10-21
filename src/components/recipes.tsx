"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ChefHat,
  Check,
  Clock,
  Leaf,
  ShoppingBag,
  Users,
} from "lucide-react";
import {
  recipes,
  ingredientAmount,
  ingredientPacks,
  type Recipe,
} from "@/lib/recipes";
import type { Product } from "@/lib/catalog";
import { money } from "@/lib/commerce";
import { useShop } from "./shop-provider";
import { AddSelection } from "./basket-selection";
import { Breadcrumb, ProductImage, SectionTitle } from "./ui";

function RecipePhotos({ recipe }: { recipe: Recipe }) {
  return (
    <div className={`recipe-photos recipe-${recipe.slug}`}>
      {recipe.atlas.map((atlas, i) => (
        <ProductImage
          key={atlas}
          product={
            {
              atlas,
              name: recipe.ingredients[i]?.name || recipe.title,
            } as Product
          }
        />
      ))}
    </div>
  );
}
export function RecipeShelf() {
  return (
    <section className="recipe-shelf">
      <SectionTitle
        title="A little inspiration for your table"
        subtitle="Simple recipes. Clear ingredients. A basket made for you."
        href="/recipes"
        linkText="Explore recipes"
      />
      <div className="recipe-card-grid">
        {recipes.map((recipe) => (
          <Link
            className="recipe-card"
            href={`/recipes/${recipe.slug}`}
            key={recipe.slug}
          >
            <RecipePhotos recipe={recipe} />
            <div>
              <span className="eyebrow">{recipe.eyebrow}</span>
              <h3>{recipe.title}</h3>
              <p>{recipe.description}</p>
              <footer>
                <span>
                  <Clock size={14} />
                  {recipe.minutes} min
                </span>
                <span>
                  <Users size={14} />
                  {recipe.servings} servings
                </span>
                <ArrowRight size={18} />
              </footer>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
export function RecipesPage() {
  return (
    <div className="page-container recipes-page">
      <Breadcrumb items={[{ label: "Recipes" }]} />
      <div className="recipe-intro">
        <span className="eyebrow">
          <ChefHat size={16} /> FROM BASKET TO TABLE
        </span>
        <h1>
          Good food starts
          <br />
          with a little inspiration<span className="heading-dot">.</span>
        </h1>
        <p>
          Pick a recipe, choose your servings and shop the ingredients you need.
          Already have something? Leave it in your pantry.
        </p>
        <Leaf size={100} />
      </div>
      <RecipeShelf />
      <div className="recipe-shopping-note">
        <ShoppingBag size={23} />
        <p>
          Ingredient baskets use full product packs at current prices. Pantry
          seasonings are listed separately and are not added automatically.
        </p>
      </div>
    </div>
  );
}
export function RecipeDetails({ recipe }: { recipe: Recipe }) {
  const { catalog } = useShop();
  const [servings, setServings] = useState(recipe.servings),
    [selected, setSelected] = useState<Record<string, boolean>>(() =>
      Object.fromEntries(
        recipe.ingredients.filter((i) => i.productId).map((i) => [i.id, true]),
      ),
    ),
    [packs, setPacks] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        recipe.ingredients
          .filter((i) => i.productId)
          .map((i) => [i.id, i.productId!]),
      ),
    );
  const lines = recipe.ingredients.map((ingredient) => {
    const product = catalog.find((p) => p.id === packs[ingredient.id]);
    return {
      ingredient,
      product,
      quantity: ingredientPacks(ingredient, product, servings, recipe.servings),
    };
  });
  const chosen = lines.filter(
    (l) => selected[l.ingredient.id] && l.ingredient.productId,
  );
  const requested = chosen
    .filter((l) => l.quantity !== null)
    .map((l) => ({ productId: packs[l.ingredient.id], quantity: l.quantity! }));
  const subtotal =
    Math.round(
      chosen.reduce(
        (n, l) => n + (l.product?.price || 0) * (l.quantity || 0),
        0,
      ) * 100,
    ) / 100;
  const incomplete = chosen.some(
    (l) =>
      !l.product ||
      l.product.active === false ||
      l.quantity === null ||
      l.product.stock < l.quantity,
  );
  return (
    <div className="page-container recipe-detail-page">
      <Breadcrumb
        items={[
          { label: "Recipes", href: "/recipes" },
          { label: recipe.title },
        ]}
      />
      <div className="recipe-detail-heading">
        <div>
          <span className="eyebrow">
            <ChefHat size={15} />
            {recipe.eyebrow}
          </span>
          <h1>{recipe.title}</h1>
          <p>{recipe.description}</p>
          <div className="recipe-facts">
            <span>
              <Clock size={16} />
              {recipe.minutes} minutes
            </span>
            <span>
              <Users size={16} />
              {recipe.servings} base servings
            </span>
          </div>
        </div>
        <RecipePhotos recipe={recipe} />
      </div>
      <div className="recipe-detail-layout">
        <section className="recipe-ingredients surface-card">
          <div className="card-title">
            <div>
              <h2>Your ingredients</h2>
              <p>Tick what you need. Untick what you already have.</p>
            </div>
            <label className="servings-picker">
              Servings
              <select
                aria-label="Recipe servings"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
              >
                {[2, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            {lines.map(({ ingredient, product, quantity }) => {
              const variants = ingredient.productId
                ? catalog.filter(
                    (p) =>
                      p.id === ingredient.productId ||
                      p.parentId === ingredient.productId,
                  )
                : [];
              return (
                <article
                  className={`recipe-ingredient-row ${!ingredient.productId ? "pantry-ingredient" : ""}`}
                  key={ingredient.id}
                >
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Include ${ingredient.name}`}
                      checked={!!selected[ingredient.id]}
                      disabled={!ingredient.productId}
                      onChange={(e) =>
                        setSelected((previous) => ({
                          ...previous,
                          [ingredient.id]: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      {product ? (
                        <ProductImage product={product} />
                      ) : (
                        <span className="round-icon">
                          <ChefHat size={21} />
                        </span>
                      )}
                    </span>
                    <span>
                      <strong>{ingredient.name}</strong>
                      <small>
                        Need{" "}
                        {ingredientAmount(
                          ingredient,
                          servings,
                          recipe.servings,
                        )}
                      </small>
                      {ingredient.productId ? (
                        <em>
                          {product && quantity !== null
                            ? `Buying ${quantity} × ${product.unit}`
                            : "Pack measurement or product unavailable"}
                        </em>
                      ) : (
                        <em>Pantry item · not added to basket</em>
                      )}
                    </span>
                  </label>
                  <div>
                    {variants.length > 1 && (
                      <select
                        aria-label={`Pack for ${ingredient.name}`}
                        value={packs[ingredient.id]}
                        onChange={(e) =>
                          setPacks((previous) => ({
                            ...previous,
                            [ingredient.id]: e.target.value,
                          }))
                        }
                      >
                        {variants.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.unit}
                          </option>
                        ))}
                      </select>
                    )}
                    {product && quantity !== null && (
                      <strong>{money(product.price * quantity)}</strong>
                    )}
                    {ingredient.productId &&
                      (!product || product.stock < (quantity || 1)) && (
                        <small className="list-stock-note">
                          Currently unavailable in this quantity
                        </small>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="recipe-allergen-note">{recipe.allergenNote}</p>
        </section>
        <aside className="recipe-purchase-card">
          <span className="round-icon">
            <ShoppingBag size={26} />
          </span>
          <h2>A basket for this recipe</h2>
          <p>Full packs of your selected ingredients.</p>
          <div className="recipe-basket-total">
            <span>Products subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <small>
            {chosen.length} selected ingredients · delivery calculated in basket
          </small>
          {incomplete && (
            <p className="selection-message">
              Some selected ingredients are unavailable or have no pack
              measurement. Untick them or choose another pack.
            </p>
          )}
          <AddSelection
            items={incomplete ? [] : requested}
            strict
            label="Add selected ingredients"
          />
          <Link href="/cart" className="button outline">
            Review my basket <ArrowRight size={16} />
          </Link>
          <p className="recipe-pack-explainer">
            <Check size={15} /> You buy whole packs. Extras can stay for your
            next meal; pantry items are not included.
          </p>
        </aside>
        <section className="recipe-method surface-card">
          <span className="eyebrow">A FEW SIMPLE STEPS</span>
          <h2>Let’s make something good.</h2>
          <ol>
            {recipe.steps.map((step, i) => (
              <li key={step}>
                <span>{i + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p className="muted">
            Preparation times are approximate. Adjust seasoning to taste and
            follow product storage instructions.
          </p>
        </section>
      </div>
      <RecipeShelf />
    </div>
  );
}
