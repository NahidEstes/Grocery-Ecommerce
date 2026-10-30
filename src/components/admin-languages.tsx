"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import type { Product } from "@/lib/catalog";
import type { Recipe } from "@/lib/recipes";
import type { ContentConfig } from "@/lib/management";
import {
  confirmTranslations,
  languageFields,
  readText,
  withText,
  type ContentKind,
} from "@/lib/content-language";
import { Notice, useUnsaved } from "./admin-shared";
type Entity = Product | Recipe | ContentConfig;
export function ContentLanguages({
  products,
  reload,
}: {
  products: Product[];
  reload: () => Promise<void>;
}) {
  const [data, setData] = useState<{
      content: ContentConfig;
      recipes: Recipe[];
    }>(),
    [error, setError] = useState("");
  const [kind, setKind] = useState<ContentKind>("product"),
    [selected, setSelected] = useState(products[0]?.id || "");
  const { confirmLeave, clean } = useUnsaved();
  async function load() {
    setData(await api("/admin/content"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  const entities =
    kind === "product"
      ? products.map((p) => ({
          id: p.id,
          label: `${p.name} · ${p.unit}`,
          value: p,
        }))
      : kind === "recipe"
        ? (data?.recipes || []).map((r) => ({
            id: r.slug,
            label: r.title,
            value: r,
          }))
        : data
          ? [
              {
                id: "homepage",
                label: "Homepage hero, banners & headings",
                value: data.content,
              },
            ]
          : [];
  const entity = entities.find((e) => e.id === selected) || entities[0];
  return (
    <div className="management-stack">
      <section className="surface-card">
        <span className="eyebrow">ENGLISH / বাংলা</span>
        <h2>Bilingual content editor</h2>
        <p>
          Write customer-facing copy in both languages. Product IDs, URLs,
          prices, measurements and stock stay shared. Empty Bangla fields use
          existing copy and built-in translations.
        </p>
        <div className="bilingual-picker">
          <label>
            Content type
            <select
              value={kind}
              onChange={async (e) => {
                const value = e.target.value as ContentKind;
                if (await confirmLeave()) {
                  clean();
                  setKind(value);
                  setSelected("");
                }
              }}
            >
              <option value="product">Products</option>
              <option value="homepage">Homepage & banners</option>
              <option value="recipe">Recipes</option>
            </select>
          </label>
          <label>
            Choose content
            <select
              value={entity?.id || ""}
              onChange={async (e) => {
                const value = e.target.value;
                if (await confirmLeave()) {
                  clean();
                  setSelected(value);
                }
              }}
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <Notice error={error} />
      {entity ? (
        <LanguageEditor
          key={`${kind}-${entity.id}`}
          kind={kind}
          initial={entity.value}
          onSave={async (value) => {
            if (kind === "product")
              await api(`/admin/products/${(value as Product).id}`, {
                method: "PUT",
                body: JSON.stringify(value),
              });
            else if (kind === "recipe")
              await api(`/admin/recipes/${(value as Recipe).slug}`, {
                method: "PUT",
                body: JSON.stringify(value),
              });
            else
              await api("/admin/content", {
                method: "PUT",
                body: JSON.stringify(value),
              });
            await Promise.all([reload(), load()]);
          }}
        />
      ) : (
        <p className="quiet-empty">
          No content available. Create it in the corresponding management
          section first.
        </p>
      )}
    </div>
  );
}
function LanguageEditor({
  kind,
  initial,
  onSave,
}: {
  kind: ContentKind;
  initial: Entity;
  onSave: (entity: Entity) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const { markDirty, clean } = useUnsaved();
  useEffect(() => {
    setDraft(initial);
  }, [initial]);
  useEffect(() => () => clean(), []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await onSave(confirmTranslations(kind, draft));
      clean();
      setSuccess(
        "Both languages saved. Check the storefront language switch to preview.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="bilingual-editor management-editor"
      onSubmit={submit}
      onChange={markDirty}
    >
      <p className="surface-card">
        Saving confirms the Bangla copy against the English text shown here.
        Later English edits in other editors leave outdated translations
        unpublished until reviewed here.
      </p>
      {languageFields(kind, draft).map((field) => {
        const english = readText(draft, field.path),
          translation = draft.translations?.bn?.[field.path];
        const Element = field.multiline ? "textarea" : "input";
        return (
          <section className="surface-card bilingual-field" key={field.path}>
            <div className="card-title">
              <h3>{field.label}</h3>
              {translation?.text && translation.source !== english && (
                <span className="translation-warning">
                  Review Bangla after English changes
                </span>
              )}
            </div>
            <div className="bilingual-columns">
              <label lang="en">
                English
                <Element
                  aria-label={`${field.label} English`}
                  value={english}
                  maxLength={field.max}
                  rows={field.multiline ? 3 : undefined}
                  onChange={(e) =>
                    setDraft((p) => withText(p, field.path, e.target.value))
                  }
                />
              </label>
              <label lang="bn">
                বাংলা
                <Element
                  aria-label={`${field.label} বাংলা`}
                  value={translation?.text || ""}
                  maxLength={field.max}
                  rows={field.multiline ? 3 : undefined}
                  placeholder="বাংলা লিখুন (ঐচ্ছিক)"
                  onChange={(e) => {
                    const text = e.target.value;
                    setDraft((p) => ({
                      ...p,
                      translations: {
                        bn: {
                          ...p.translations?.bn,
                          [field.path]: {
                            source: readText(p, field.path),
                            text,
                          },
                        },
                      },
                    }));
                  }}
                />
              </label>
            </div>
          </section>
        );
      })}
      <Notice error={error} success={success} />
      <div className="management-save">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save both languages"}
        </button>
        <span>Changes appear on the storefront after refresh.</span>
      </div>
    </form>
  );
}
