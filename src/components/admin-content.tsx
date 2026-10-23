"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ChefHat, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import type { ContentConfig } from "@/lib/management";
import type { Recipe, RecipeIngredient } from "@/lib/recipes";
import type { Product } from "@/lib/catalog";
import { ImageUploadField, Notice, useUnsaved } from "./admin-shared";
const inputLabels: Record<string, string> = {
  eyebrow: "Small heading",
  title: "Main heading",
  highlight: "Highlighted text",
  description: "Description",
  button: "Button label",
  href: "Button destination",
};
export function HomepageEditor({
  initial,
  onSave,
}: {
  initial: ContentConfig;
  onSave: (value: ContentConfig) => Promise<ContentConfig>;
}) {
  const [draft, setDraft] = useState(structuredClone(initial)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const { markDirty, clean } = useUnsaved();
  useEffect(() => () => clean(), []);
  function update(section: "hero" | number, key: string, value: string) {
    setDraft((p) =>
      section === "hero"
        ? { ...p, hero: { ...p.hero, [key]: value } }
        : {
            ...p,
            banners: p.banners.map((b, i) =>
              i === section ? { ...b, [key]: value } : b,
            ),
          },
    );
    markDirty();
  }
  return (
    <form
      className="enhance-form management-editor"
      onChange={markDirty}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSuccess("");
        try {
          const form = new FormData(e.currentTarget);
          if (
            [
              "hero-image-uploading",
              "banner-0-image-uploading",
              "banner-1-image-uploading",
            ].some((k) => form.get(k) === "true")
          )
            throw new Error(
              "Wait for the image upload to finish before saving.",
            );
          const saved = await onSave({
            ...draft,
            hero: {
              ...draft.hero,
              imageUrl: String(form.get("hero-image") || ""),
            },
            banners: draft.banners.map((b, i) => ({
              ...b,
              imageUrl: String(form.get(`banner-${i}-image`) || ""),
            })),
          });
          setDraft(saved);
          clean();
          setSuccess(
            "Homepage saved. Open the storefront to see your changes.",
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="surface-card">
        <div className="card-title">
          <div>
            <span className="eyebrow">MAKE IT YOUR STOREFRONT</span>
            <h2>Homepage editor</h2>
            <p>Edit the hero, promotional banners and section order.</p>
          </div>
          <a className="button outline small" href="/" target="_blank">
            Open storefront ↗
          </a>
        </div>
        <h3>Main hero</h3>
        <div className="form-grid">
          {Object.entries(inputLabels).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required
                maxLength={
                  key === "description" ? 250 : key === "href" ? 200 : 100
                }
                value={draft.hero[key as keyof typeof draft.hero]}
                onChange={(e) => update("hero", key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <ImageUploadField
          key={`hero-${initial.version}`}
          name="hero-image"
          label="Hero photo"
          initial={draft.hero.imageUrl}
        />
        <p className="muted">
          Destinations can point to /products, /recipes, /lists, a product page
          or a category such as /products?category=fruits.
        </p>
      </section>
      {draft.banners.map((banner, index) => (
        <section className="surface-card" key={index}>
          <h2>Promotional banner {index + 1}</h2>
          <div className="form-grid">
            {Object.entries(inputLabels)
              .filter(([k]) => k !== "highlight")
              .map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    maxLength={
                      key === "description" ? 250 : key === "href" ? 200 : 100
                    }
                    value={banner[key as keyof typeof banner]}
                    onChange={(e) => update(index, key, e.target.value)}
                  />
                </label>
              ))}
          </div>
          <ImageUploadField
            key={`banner-${index}-${initial.version}`}
            name={`banner-${index}-image`}
            label="Banner photo"
            initial={banner.imageUrl}
          />
        </section>
      ))}
      <section className="surface-card">
        <h2>Personal shopping & deals</h2>
        <div className="management-toggle-grid">
          {[
            ["showRegular", "Regular purchases & shopping lists"],
            ["showActiveOrder", "Active order status"],
            ["showDeals", "Today’s deals"],
          ].map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <input
                type="checkbox"
                checked={!!draft[key as keyof ContentConfig]}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <label>
          Deals section heading
          <input
            required
            maxLength={100}
            value={draft.dealsTitle}
            onChange={(e) =>
              setDraft((p) => ({ ...p, dealsTitle: e.target.value }))
            }
          />
        </label>
      </section>
      <section className="surface-card">
        <h2>Arrange your homepage</h2>
        <p>Move sections up or down, change headings, or turn a section off.</p>
        <div className="home-section-editor">
          {draft.sections.map((section, index) => (
            <div key={section.id}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label={`Show ${section.id} section`}
                  checked={section.enabled}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      sections: p.sections.map((s) =>
                        s.id === section.id
                          ? { ...s, enabled: e.target.checked }
                          : s,
                      ),
                    }))
                  }
                />
                <span>{section.id}</span>
              </label>
              <input
                aria-label={`${section.id} heading`}
                value={section.title}
                required
                maxLength={100}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    sections: p.sections.map((s) =>
                      s.id === section.id ? { ...s, title: e.target.value } : s,
                    ),
                  }))
                }
              />
              <button
                type="button"
                className="icon-button"
                disabled={!index}
                aria-label={`Move ${section.id} up`}
                onClick={() => {
                  setDraft((p) => {
                    const sections = [...p.sections];
                    [sections[index - 1], sections[index]] = [
                      sections[index],
                      sections[index - 1],
                    ];
                    return { ...p, sections };
                  });
                  markDirty();
                }}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={index === draft.sections.length - 1}
                aria-label={`Move ${section.id} down`}
                onClick={() => {
                  setDraft((p) => {
                    const sections = [...p.sections];
                    [sections[index + 1], sections[index]] = [
                      sections[index],
                      sections[index + 1],
                    ];
                    return { ...p, sections };
                  });
                  markDirty();
                }}
              >
                <ArrowDown size={17} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <Notice error={error} success={success} />
      <div className="management-save">
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy ? "Saving…" : "Save homepage"}
        </button>
        <span>Changes are published to this storefront when saved.</span>
      </div>
    </form>
  );
}
export function RecipeManager({
  recipes,
  products,
  reload,
}: {
  recipes: Recipe[];
  products: Product[];
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Recipe | null | undefined>(),
    [query, setQuery] = useState(""),
    [success, setSuccess] = useState("");
  const { confirmLeave, clean } = useUnsaved();
  if (editing !== undefined)
    return (
      <RecipeEditor
        key={editing?.slug || "new"}
        initial={editing}
        products={products}
        onCancel={async () => {
          if (await confirmLeave()) setEditing(undefined);
        }}
        onSave={async (recipe) => {
          await api(`/admin/recipes/${recipe.slug}`, {
            method: "PUT",
            body: JSON.stringify(recipe),
          });
          clean();
          await reload();
          setEditing(undefined);
          setSuccess(
            "Recipe saved. Published recipes are available in the storefront.",
          );
        }}
      />
    );
  return (
    <div className="management-stack">
      <div className="surface-card management-toolbar">
        <div>
          <span className="eyebrow">FROM BASKET TO TABLE</span>
          <h2>Recipes & meal ideas</h2>
          <p>Link ingredients to real packs. Unpublish a recipe to hide it.</p>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus size={17} />
          New recipe
        </button>
      </div>
      <Notice success={success} />
      <input
        className="management-search"
        aria-label="Find recipes"
        placeholder="Search recipes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="admin-recipe-grid">
        {recipes
          .filter((r) =>
            `${r.title} ${r.slug}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((recipe) => (
            <article className="surface-card" key={recipe.slug}>
              {recipe.imageUrl ? (
                <img src={recipe.imageUrl} alt={recipe.title} />
              ) : (
                <span className="recipe-admin-icon">
                  <ChefHat size={38} />
                </span>
              )}
              <div className="card-title">
                <h3>{recipe.title}</h3>
                <span
                  className={`management-badge ${recipe.active === false ? "muted" : "success"}`}
                >
                  {recipe.active === false ? "Unpublished" : "Published"}
                </span>
              </div>
              <p>{recipe.description}</p>
              <small>
                {recipe.minutes} min · {recipe.servings} base servings ·{" "}
                {recipe.ingredients.length} ingredients
              </small>
              <div className="inline-actions">
                <button
                  className="button outline small"
                  onClick={() => setEditing(recipe)}
                >
                  Edit recipe
                </button>
                {recipe.active !== false && (
                  <a
                    className="button outline small"
                    href={`/recipes/${recipe.slug}`}
                    target="_blank"
                  >
                    View recipe ↗
                  </a>
                )}
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}
function RecipeEditor({
  initial,
  products,
  onSave,
  onCancel,
}: {
  initial: Recipe | null;
  products: Product[];
  onSave: (r: Recipe) => Promise<void>;
  onCancel: () => void;
}) {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
      initial?.ingredients || [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { markDirty, clean } = useUnsaved();
  useEffect(() => () => clean(), []);
  const measured = products.filter(
    (p) => p.active !== false && p.measure && p.measureUnit,
  );
  function patch(id: string, value: Partial<RecipeIngredient>) {
    setIngredients((old) =>
      old.map((i) => (i.id === id ? { ...i, ...value } : i)),
    );
    markDirty();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      text = (key: string) => String(form.get(key) || "").trim();
    setBusy(true);
    setError("");
    try {
      if (form.get("imageUrl-uploading") === "true")
        throw new Error("Wait for the image upload to finish before saving.");
      await onSave({
        slug: text("slug"),
        title: text("title"),
        description: text("description"),
        eyebrow: text("eyebrow"),
        minutes: Number(form.get("minutes")),
        servings: Number(form.get("servings")),
        version: initial?.version || 0,
        active: form.has("active"),
        imageUrl: text("imageUrl"),
        atlas: ingredients
          .filter((i) => i.productId)
          .map((i) => products.find((p) => p.id === i.productId)?.atlas || 0)
          .slice(0, 3)
          .concat(0)
          .slice(0, 3),
        ingredients,
        steps: text("steps")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        allergenNote: text("allergenNote"),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="enhance-form management-editor"
      onSubmit={submit}
      onChange={markDirty}
    >
      <section className="surface-card">
        <div className="card-title">
          <div>
            <span className="eyebrow">A LITTLE INSPIRATION</span>
            <h2>{initial ? "Edit recipe" : "Create a recipe"}</h2>
          </div>
          <button
            type="button"
            className="button outline small"
            disabled={busy}
            onClick={onCancel}
          >
            Back to recipes
          </button>
        </div>
        <div className="form-grid">
          {[
            ["title", "Recipe name"],
            ["slug", "Recipe URL name"],
            ["eyebrow", "Small heading"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                required
                maxLength={name === "eyebrow" ? 70 : 100}
                pattern={name === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
                readOnly={name === "slug" && !!initial}
                defaultValue={initial?.[name as "title" | "slug" | "eyebrow"]}
              />
            </label>
          ))}
          <label>
            Preparation time (minutes)
            <input
              name="minutes"
              type="number"
              required
              min={1}
              max={600}
              defaultValue={initial?.minutes || 15}
            />
          </label>
          <label>
            Base servings
            <input
              name="servings"
              type="number"
              required
              min={1}
              max={20}
              defaultValue={initial?.servings || 2}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initial?.active !== false}
            />
            Published
          </label>
        </div>
        <label>
          Description
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={400}
            defaultValue={initial?.description}
          />
        </label>
        <ImageUploadField initial={initial?.imageUrl} />
      </section>
      <section className="surface-card">
        <div className="card-title">
          <div>
            <h2>Ingredients</h2>
            <p>
              Amounts refer to the base servings. Linked products must have
              matching pack measurements.
            </p>
          </div>
          <button
            className="button outline small"
            type="button"
            disabled={ingredients.length >= 30}
            onClick={() => {
              setIngredients((p) => [
                ...p,
                {
                  id: `ingredient-${crypto.randomUUID().slice(0, 8)}`,
                  name: "",
                  pantry: "To taste",
                },
              ]);
              markDirty();
            }}
          >
            <Plus size={15} />
            Add ingredient
          </button>
        </div>
        {!ingredients.length && (
          <p className="quiet-empty">Add your first ingredient.</p>
        )}
        {ingredients.map((ingredient) => (
          <div className="recipe-admin-ingredient" key={ingredient.id}>
            <label>
              Ingredient name
              <input
                value={ingredient.name}
                required
                minLength={2}
                maxLength={100}
                onChange={(e) => patch(ingredient.id, { name: e.target.value })}
              />
            </label>
            <label>
              Shop product or pantry item
              <select
                aria-label={`Product for ${ingredient.name || "new ingredient"}`}
                value={ingredient.productId || ""}
                onChange={(e) => {
                  const p = products.find((p) => p.id === e.target.value);
                  patch(
                    ingredient.id,
                    p
                      ? {
                          productId: p.id,
                          amount: ingredient.amount || p.measure,
                          measureUnit: p.measureUnit,
                          pantry: undefined,
                        }
                      : {
                          productId: undefined,
                          amount: undefined,
                          measureUnit: undefined,
                          pantry: "To taste",
                        },
                  );
                }}
              >
                <option value="">Pantry item · not purchased</option>
                {measured.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.unit}
                  </option>
                ))}
              </select>
            </label>
            {ingredient.productId ? (
              <label>
                Amount needed ({ingredient.measureUnit})
                <input
                  type="number"
                  min={0.001}
                  max={1000}
                  step="any"
                  required
                  value={ingredient.amount || ""}
                  onChange={(e) =>
                    patch(ingredient.id, { amount: Number(e.target.value) })
                  }
                />
              </label>
            ) : (
              <label>
                Pantry quantity / note
                <input
                  required
                  maxLength={200}
                  value={ingredient.pantry || ""}
                  onChange={(e) =>
                    patch(ingredient.id, { pantry: e.target.value })
                  }
                />
              </label>
            )}
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ingredient ${ingredient.name || "new ingredient"}`}
              onClick={() => {
                setIngredients((p) => p.filter((i) => i.id !== ingredient.id));
                markDirty();
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </section>
      <section className="surface-card">
        <h2>Preparation & product notes</h2>
        <label>
          Cooking steps (one step per line)
          <textarea
            className="steps-textarea"
            name="steps"
            required
            defaultValue={initial?.steps.join("\n")}
            maxLength={15000}
          />
        </label>
        <label>
          Allergen and product note
          <textarea
            name="allergenNote"
            maxLength={1000}
            defaultValue={initial?.allergenNote}
          />
        </label>
      </section>
      <Notice error={error} />
      <div className="management-save">
        <button
          className="button primary"
          disabled={busy || !ingredients.length}
        >
          <Save size={17} />
          {busy ? "Saving…" : "Save recipe"}
        </button>
      </div>
    </form>
  );
}
