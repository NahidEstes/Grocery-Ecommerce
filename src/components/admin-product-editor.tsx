"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  Languages,
  Leaf,
  Package,
  Save,
  ShoppingBag,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/storefront";
import { languageFields, localizeProduct } from "@/lib/content-language";
import { translate, type Locale } from "@/lib/i18n";
import {
  createProductDraft,
  isProductImageUrl,
  productDraftPayload,
  productFieldSection,
  productKey,
  productSections,
  validateProductDraft,
  type ProductDraft,
  type ProductErrors,
  type ProductSave,
  type ProductSection,
} from "@/lib/admin-products";
import { ImageUploadField, useUnsaved } from "./admin-shared";
import { ProductImage } from "./ui";
import { useStoreFormat } from "./store-format";

export function AdminProductEditor({
  product,
  catalog,
  settings,
  onSave,
  onCancel,
}: {
  product: Product | null;
  catalog: Product[];
  settings: StoreSettings;
  onSave: (product: ProductSave) => Promise<void>;
  onCancel: () => void;
}) {
  const [initial] = useState(() =>
    createProductDraft(product, settings.categories[0]?.slug),
  );
  const [draft, setDraft] = useState(initial),
    [section, setSection] = useState<ProductSection>("basics"),
    [errors, setErrors] = useState<ProductErrors>({});
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [failure, setFailure] = useState(""),
    [previewLocale, setPreviewLocale] = useState<Locale>("en");
  const customized = useRef({ id: !!product, slug: !!product }),
    saving = useRef(false),
    focusTarget = useRef<string | null>(null);
  const { markDirty, clean, confirmLeave } = useUnsaved(),
    { money } = useStoreFormat();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => {
    if (dirty || uploading) markDirty();
    else clean();
  }, [dirty, uploading]);
  useEffect(() => () => clean(), []);
  useEffect(() => {
    if (focusTarget.current) {
      const target = document.getElementById(focusTarget.current);
      target?.closest("details")?.setAttribute("open", "");
      target?.focus();
      focusTarget.current = null;
    }
  }, [section, errors]);
  function patch(value: Partial<ProductDraft>) {
    setDraft((previous) => ({ ...previous, ...value }));
    setFailure("");
  }
  function update(key: keyof ProductDraft, value: string | number | boolean) {
    const next: Partial<ProductDraft> = { [key]: value };
    if (key === "id" || key === "slug") customized.current[key] = true;
    if (key === "name" && !product) {
      const generated = productKey(String(value));
      if (!customized.current.id) next.id = generated;
      if (!customized.current.slug) next.slug = generated;
    }
    patch(next);
    setErrors((previous) => {
      const copy = { ...previous };
      delete copy[key];
      if (key === "name" && !product) {
        if (!customized.current.id) delete copy.id;
        if (!customized.current.slug) delete copy.slug;
      }
      return copy;
    });
  }
  function showField(field: string) {
    focusTarget.current = `product-field-${field}`;
    setSection(productFieldSection(field));
    requestAnimationFrame(() => {
      document.getElementById(`product-field-${field}`)?.focus();
    });
  }
  async function leave() {
    if (!busy && !uploading && (await confirmLeave())) onCancel();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || uploading) return;
    const invalid = validateProductDraft(draft, product, catalog);
    setErrors(invalid);
    setFailure("");
    const first = Object.keys(invalid)[0];
    if (first) {
      showField(first);
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      await onSave(productDraftPayload(draft, product));
      clean();
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "The product could not be saved. Your changes are still here.",
      );
      saving.current = false;
      setBusy(false);
    }
  }
  function field(
    key: keyof ProductDraft,
    label: string,
    options: {
      type?: string;
      hint?: string;
      max?: number;
      min?: number;
      step?: string;
      required?: boolean;
      placeholder?: string;
      multiline?: boolean;
      readOnly?: boolean;
    } = {},
  ) {
    const id = `product-field-${key}`,
      problem = errors[key];
    const common = {
      id,
      name: key,
      value: String(draft[key] ?? ""),
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => update(key, event.target.value),
      onBlur: () =>
        setErrors((previous) => ({
          ...previous,
          [key]: validateProductDraft(draft, product, catalog)[key],
        })),
      "aria-invalid": !!problem || undefined,
      "aria-describedby": `${id}-hint${problem ? ` ${id}-error` : ""}`,
      required: options.required,
      maxLength: options.max,
      placeholder: options.placeholder,
      readOnly: options.readOnly,
    };
    return (
      <label
        className={`product-field ${problem ? "has-error" : ""}`}
        key={key}
        htmlFor={id}
      >
        <span>
          {label}
          {options.required && <i aria-hidden="true"> *</i>}
        </span>
        {options.multiline ? (
          <textarea {...common} rows={4} />
        ) : (
          <input
            {...common}
            type={options.type || "text"}
            min={options.min}
            max={options.type === "number" ? options.max : undefined}
            step={options.step}
            inputMode={
              options.type === "number"
                ? key === "stock" || key === "lowStockThreshold"
                  ? "numeric"
                  : "decimal"
                : undefined
            }
          />
        )}
        <small id={`${id}-hint`}>{options.hint}</small>
        {problem && <em id={`${id}-error`}>{problem}</em>}
      </label>
    );
  }
  function select(
    key: keyof ProductDraft,
    label: string,
    children: ReactNode,
    hint?: string,
  ) {
    const id = `product-field-${key}`;
    return (
      <label className="product-field" htmlFor={id}>
        <span>{label}</span>
        <select
          id={id}
          name={key}
          value={String(draft[key])}
          onChange={(event) => update(key, event.target.value)}
          aria-invalid={!!errors[key] || undefined}
          aria-describedby={`${id}-hint${errors[key] ? ` ${id}-error` : ""}`}
        >
          {children}
        </select>
        <small id={`${id}-hint`}>{hint}</small>
        {errors[key] && <em id={`${id}-error`}>{errors[key]}</em>}
      </label>
    );
  }
  const preview = productDraftPayload(draft, product),
    activeIndex = productSections.findIndex((step) => step.id === section);
  const categories = [
    ...new Map(
      [
        ...settings.categories,
        ...(!settings.categories.some(
          (category) => category.slug === product?.category,
        ) && product
          ? [{ slug: product.category, name: product.category, atlas: 0 }]
          : []),
      ].map((category) => [category.slug, category]),
    ).values(),
  ];
  function photoPreview() {
    const localized = localizeProduct(preview, previewLocale);
    const sample = {
      ...localized,
      name: localized.name || "Your product name",
      atlas: draft.atlas,
      imageUrl: isProductImageUrl(draft.imageUrl) ? draft.imageUrl : "",
    };
    return (
      <div className="product-live-preview">
        <div className="product-preview-heading">
          <span>
            <Eye size={15} />
            Customer preview
          </span>
          <div role="group" aria-label="Preview language">
            {(["en", "bn"] as const).map((locale) => (
              <button
                key={locale}
                type="button"
                aria-pressed={previewLocale === locale}
                onClick={() => setPreviewLocale(locale)}
              >
                {locale === "en" ? "EN" : "বাংলা"}
              </button>
            ))}
          </div>
        </div>
        <div className="product-preview-photo">
          <ProductImage product={sample} />
          {!draft.active && <span>Hidden from store</span>}
        </div>
        <span className="product-preview-category">
          {categories.find((category) => category.slug === draft.category)
            ?.name || "Category"}
        </span>
        <h3>{translate(previewLocale, sample.name)}</h3>
        <p>{translate(previewLocale, sample.unit || "Pack size")}</p>
        <div className="product-preview-price">
          <strong>
            {Number.isFinite(preview.price) && preview.price > 0
              ? money(preview.price)
              : "—"}
          </strong>
          {preview.originalPrice && preview.originalPrice >= preview.price ? (
            <del>{money(preview.originalPrice)}</del>
          ) : null}
        </div>
        <p className="product-preview-comparison">
          {Number(preview.measure) > 0 && preview.price > 0
            ? `${money(preview.price / preview.measure!)} / ${preview.measureUnit}`
            : "Add a pack amount to show a comparison price."}
        </p>
        <span
          className={`product-preview-stock ${Number(draft.stock) < 1 ? "empty" : ""}`}
        >
          <Package size={13} />
          {Number(draft.stock) > 0
            ? `${draft.stock} packs in stock`
            : "Out of stock"}
        </span>
        <div className="product-preview-disclaimer">
          Preview only. Save your changes to update the storefront.
        </div>
      </div>
    );
  }
  return (
    <div className="product-editor-workspace">
      <div className="product-editor-heading">
        <div>
          <button
            className="workspace-text-button"
            type="button"
            onClick={() => void leave()}
            disabled={busy || uploading}
          >
            <ArrowLeft size={15} />
            Back to products
          </button>
          <h1>{product ? "Edit product" : "Add a product"}</h1>
          <p>
            {product
              ? `Update ${product.name}, one section at a time.`
              : "Start with the essentials. Optional details can be added later."}
          </p>
        </div>
        <span className={`product-draft-badge ${dirty ? "dirty" : ""}`}>
          <i />
          {dirty
            ? "Unsaved changes"
            : product
              ? "Saved product"
              : "New product"}
        </span>
      </div>
      <div className="product-editor-layout">
        <form className="product-editor-form" onSubmit={submit} noValidate>
          <div
            className="product-editor-tabs"
            role="tablist"
            aria-label="Product editor sections"
          >
            {productSections.map((step, index) => (
              <button
                type="button"
                role="tab"
                id={`product-tab-${step.id}`}
                key={step.id}
                aria-selected={section === step.id}
                aria-controls={`product-panel-${step.id}`}
                tabIndex={section === step.id ? 0 : -1}
                disabled={busy}
                onClick={() => setSection(step.id)}
                onKeyDown={(event) => {
                  const target =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? productSections.length - 1
                        : event.key === "ArrowRight"
                          ? (index + 1) % productSections.length
                          : event.key === "ArrowLeft"
                            ? (index + productSections.length - 1) %
                              productSections.length
                            : -1;
                  if (target >= 0) {
                    event.preventDefault();
                    setSection(productSections[target].id);
                    document
                      .getElementById(
                        `product-tab-${productSections[target].id}`,
                      )
                      ?.focus();
                  }
                }}
              >
                <b>{index + 1}</b>
                {step.label}
                {Object.entries(errors).some(
                  ([field, error]) =>
                    error && productFieldSection(field) === step.id,
                ) && <CircleAlert size={13} />}
              </button>
            ))}
          </div>
          {!!Object.values(errors).filter(Boolean).length && (
            <div className="product-error-summary" role="alert">
              <strong>
                <CircleAlert size={17} />A few details need your attention
              </strong>
              {Object.entries(errors)
                .filter(([, message]) => !!message)
                .map(([key, message]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => showField(key)}
                  >
                    {message}
                  </button>
                ))}
            </div>
          )}
          {failure && (
            <div className="product-error-summary" role="alert">
              <strong>We couldn’t save this product.</strong>
              <p>{failure}</p>
              <p>
                Your draft is kept here. If another edit changed this product,
                return to the list and reopen its latest version.
              </p>
            </div>
          )}
          <fieldset disabled={busy} className="product-editor-fields">
            {productSections.map((step) => (
              <section
                role="tabpanel"
                aria-labelledby={`product-tab-${step.id}`}
                id={`product-panel-${step.id}`}
                key={step.id}
                hidden={section !== step.id}
                className="product-editor-section"
              >
                <div className="product-section-intro">
                  <span className="eyebrow">
                    STEP{" "}
                    {productSections.findIndex((item) => item.id === step.id) +
                      1}{" "}
                    OF {productSections.length}
                  </span>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
                {step.id === "basics" && (
                  <>
                    <div className="product-field-grid">
                      {field("name", "Product name", {
                        required: true,
                        max: 120,
                        placeholder: "e.g. Fresh garden tomatoes",
                      })}
                      {select(
                        "category",
                        "Category",
                        categories.map((category) => (
                          <option key={category.slug} value={category.slug}>
                            {category.name}
                          </option>
                        )),
                        "Choose the aisle where customers should find it.",
                      )}
                      {field("unit", "Pack label", {
                        required: true,
                        max: 60,
                        placeholder: "e.g. 500 g, 1 litre or 6 pieces",
                        hint: "This is the pack customers buy. Stock is counted in these packs.",
                      })}
                      {field("brand", "Brand", {
                        max: 80,
                        placeholder: "Optional",
                        hint: "Leave blank when the brand is not known.",
                      })}
                    </div>
                    {field("description", "Description", {
                      multiline: true,
                      max: 2000,
                      placeholder:
                        "What should customers know about this product?",
                      hint: `${draft.description.length}/2000 characters · Optional`,
                    })}
                    <details className="product-optional">
                      <summary>
                        Product identity & search <ChevronDown size={16} />
                      </summary>
                      <div className="product-field-grid">
                        {field("id", "SKU / product ID", {
                          required: true,
                          max: 60,
                          readOnly: !!product,
                          hint: product
                            ? "This ID stays fixed to protect stock and order history."
                            : "Suggested from the name. Each pack needs a unique ID.",
                        })}
                        {field("slug", "Product URL slug", {
                          required: true,
                          max: 60,
                          hint: `Storefront path: /products/${draft.slug || "your-product"}`,
                        })}
                      </div>
                      {field("searchTerms", "Search alternatives", {
                        max: 2500,
                        placeholder: "e.g. tomato, টমেটো, local tomato",
                        hint: "Separate alternatives with commas. Bengali/English search stays available.",
                      })}
                    </details>
                    <label className="product-visibility">
                      <span>
                        <strong>Visible in store</strong>
                        <small>Hidden products are kept in your catalog.</small>
                      </span>
                      <input
                        name="active"
                        type="checkbox"
                        checked={draft.active}
                        onChange={(event) =>
                          update("active", event.target.checked)
                        }
                      />
                    </label>
                  </>
                )}
                {step.id === "pricing" && (
                  <>
                    <div className="product-section-callout">
                      <ShoppingBag size={20} />
                      <span>
                        All amounts are in{" "}
                        <strong>{settings.profile.currency}</strong>. Prices
                        apply to one <strong>{draft.unit || "pack"}</strong>.
                      </span>
                    </div>
                    <div className="product-field-grid">
                      {field(
                        "price",
                        `Selling price (${settings.profile.currency})`,
                        {
                          type: "number",
                          required: true,
                          min: 0.01,
                          max: 500000,
                          step: "0.01",
                          hint: "The amount customers pay for one pack.",
                        },
                      )}
                      {field(
                        "originalPrice",
                        `Original price (${settings.profile.currency})`,
                        {
                          type: "number",
                          min: 0.01,
                          max: 500000,
                          step: "0.01",
                          hint: "Optional. Must be at least the selling price.",
                        },
                      )}
                    </div>
                    <div className="product-subheading">
                      <h4>Price comparison</h4>
                      <p>
                        Help customers compare packs. Leave the amount empty if
                        it does not apply.
                      </p>
                    </div>
                    <div className="product-field-grid">
                      {field("measure", "Amount per pack", {
                        type: "number",
                        min: 0,
                        max: 10000,
                        step: "any",
                        placeholder: "e.g. 0.5 for 500 g",
                        hint: "Use the unit selected alongside it: 500 g = 0.5 kilogram.",
                      })}
                      {select(
                        "measureUnit",
                        "Comparison unit",
                        <>
                          <option value="kg">Kilogram (kg)</option>
                          <option value="litre">Litre</option>
                          <option value="piece">Piece</option>
                        </>,
                      )}
                    </div>
                    {Number(draft.measure) > 0 && Number(draft.price) > 0 && (
                      <div className="product-price-insight">
                        <Check size={16} />
                        Comparison price:{" "}
                        {money(
                          Number(draft.price) / Number(draft.measure),
                        )} / {draft.measureUnit}
                      </div>
                    )}
                  </>
                )}
                {step.id === "stock" && (
                  <>
                    <div className="product-field-grid">
                      {field("stock", "Stock in packs", {
                        type: "number",
                        required: true,
                        min: 0,
                        max: 100000,
                        step: "1",
                        hint: "Use whole packs. Enter 0 when this pack is out of stock.",
                      })}
                      {field("lowStockThreshold", "Low-stock alert threshold", {
                        type: "number",
                        min: 0,
                        max: 100000,
                        step: "1",
                        placeholder: "Use store default",
                        hint: "Optional. Leave blank to use the store default; 0 is a valid threshold.",
                      })}
                    </div>
                    {field("changeReason", "Reason for stock change", {
                      max: 200,
                      placeholder: "e.g. Count corrected after shelf check",
                      hint: "Optional, 3–200 characters. Stock adjustments are recorded in the existing audit history.",
                    })}
                    <div className="product-subheading">
                      <h4>Pack variants</h4>
                      <p>
                        Each pack size has its own SKU, price and stock. Choose
                        a base product to group this pack with it.
                      </p>
                    </div>
                    {select(
                      "parentId",
                      "Variant of",
                      <>
                        <option value="">Base product (not a variant)</option>
                        {catalog
                          .filter(
                            (item) => !item.parentId && item.id !== product?.id,
                          )
                          .map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.name} · {item.unit}
                            </option>
                          ))}
                      </>,
                      draft.parentId
                        ? "This pack will appear alongside the other variants of its base product."
                        : "Other pack sizes can reference this product as their base.",
                    )}
                    <div className="product-section-callout">
                      <Boxes size={19} />
                      <span>
                        Stock is checked against reserved batches when you save.
                        Receive dated stock in{" "}
                        <strong>Suppliers & batches</strong>.
                      </span>
                    </div>
                  </>
                )}
                {step.id === "photos" && (
                  <>
                    <ImageUploadField
                      initial={draft.imageUrl}
                      inputId="product-field-imageUrl"
                      invalid={!!errors.imageUrl}
                      describedBy={
                        errors.imageUrl ? "product-image-error" : undefined
                      }
                      onUrlChange={(url) => update("imageUrl", url)}
                      onBusyChange={setUploading}
                      isValidUrl={isProductImageUrl}
                    />
                    {errors.imageUrl && (
                      <p
                        className="product-field-error"
                        id="product-image-error"
                      >
                        {errors.imageUrl}
                      </p>
                    )}
                    <label
                      className="product-field"
                      htmlFor="product-field-atlas"
                    >
                      <span>Bundled photo fallback</span>
                      <select
                        name="atlas"
                        id="product-field-atlas"
                        value={draft.atlas}
                        onChange={(event) =>
                          update("atlas", Number(event.target.value))
                        }
                      >
                        {[
                          "Banana",
                          "Apple",
                          "Tomato",
                          "Carrot",
                          "Broccoli",
                          "Orange",
                          "Cucumber",
                          "Potato",
                          "Milk",
                          "Bread",
                          "Eggs",
                          "Oil",
                        ].map((label, index) => (
                          <option key={index} value={index}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <small>Used when no photo URL is supplied.</small>
                    </label>
                    <details className="product-optional">
                      <summary>
                        Supplier facts & dietary details{" "}
                        <ChevronDown size={16} />
                      </summary>
                      <p className="product-supplier-note">
                        Enter confirmed supplier facts only. Leave unknown
                        information empty.
                      </p>
                      {field("origin", "Country / region of origin", {
                        max: 150,
                      })}
                      {field("dietary", "Dietary tags", {
                        max: 400,
                        hint: "Up to 8 tags, separated by commas.",
                      })}
                      {field("nutrition", "Supplier nutrition information", {
                        multiline: true,
                        max: 1500,
                      })}
                      {field("allergens", "Allergen information", {
                        multiline: true,
                        max: 1000,
                      })}
                      {field("storage", "Storage instructions", {
                        multiline: true,
                        max: 1000,
                      })}
                    </details>
                    <div className="product-check-options">
                      {(
                        [
                          {
                            key: "seasonal",
                            label: "Feature as seasonal",
                            hint: "Show in seasonal selections.",
                          },
                          {
                            key: "organic",
                            label: "Verified organic",
                            hint: "Enable only when the claim is verified.",
                          },
                        ] as const
                      ).map((option) => (
                        <label key={option.key}>
                          <input
                            type="checkbox"
                            name={option.key}
                            checked={draft[option.key]}
                            onChange={(event) =>
                              update(option.key, event.target.checked)
                            }
                          />
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.hint}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {step.id === "language" && (
                  <>
                    <div className="product-section-callout">
                      <Languages size={20} />
                      <span>
                        Bangla copy is optional. Prices, stock and pack
                        relationships stay shared. English edits keep older
                        translations unpublished until reviewed.
                      </span>
                    </div>
                    <div
                      className="product-translation-fields"
                      id="product-field-translations"
                      tabIndex={-1}
                    >
                      {languageFields("product", preview).map((item) => {
                        const english = String(
                            preview[item.path as keyof Product] || "",
                          ),
                          entry = draft.translations.bn?.[item.path],
                          stale = !!entry?.text && entry.source !== english;
                        const Element = item.multiline ? "textarea" : "input";
                        return (
                          <div
                            className="product-translation-row"
                            key={item.path}
                          >
                            <div>
                              <span>{item.label} · English</span>
                              <p>{english || "No English text yet"}</p>
                            </div>
                            <label lang="bn">
                              <span>{item.label} · বাংলা</span>
                              <Element
                                aria-label={`${item.label} বাংলা`}
                                value={entry?.text || ""}
                                rows={item.multiline ? 3 : undefined}
                                maxLength={item.max}
                                placeholder="বাংলা লিখুন (ঐচ্ছিক)"
                                onChange={(event) =>
                                  patch({
                                    translations: {
                                      ...draft.translations,
                                      bn: {
                                        ...draft.translations.bn,
                                        [item.path]: {
                                          source: english,
                                          text: event.target.value,
                                        },
                                      },
                                    },
                                  })
                                }
                              />
                            </label>
                            {stale && (
                              <div className="product-translation-review">
                                <span>
                                  English changed. Review this translation
                                  before publishing.
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    patch({
                                      translations: {
                                        ...draft.translations,
                                        bn: {
                                          ...draft.translations.bn,
                                          [item.path]: {
                                            source: english,
                                            text: entry.text,
                                          },
                                        },
                                      },
                                    })
                                  }
                                >
                                  Confirm this translation
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            ))}
          </fieldset>
          <div className="product-step-controls">
            <span>
              Step {activeIndex + 1} of {productSections.length}
            </span>
            <div>
              {activeIndex > 0 && (
                <button
                  type="button"
                  className="workspace-text-button"
                  onClick={() =>
                    setSection(productSections[activeIndex - 1].id)
                  }
                  disabled={busy}
                >
                  <ArrowLeft size={15} />
                  Previous
                </button>
              )}
              {activeIndex < productSections.length - 1 && (
                <button
                  type="button"
                  className="workspace-text-button"
                  onClick={() =>
                    setSection(productSections[activeIndex + 1].id)
                  }
                  disabled={busy}
                >
                  Next section <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="product-save-bar">
            <div>
              <span className={dirty ? "product-unsaved-dot" : ""} />
              {busy
                ? "Saving your product…"
                : uploading
                  ? "Photo uploading…"
                  : dirty
                    ? "You have unsaved changes"
                    : "Your product details"}
              <small>{product ? draft.id : "New SKU"}</small>
            </div>
            <div>
              <button
                type="button"
                className="button outline"
                onClick={() => void leave()}
                disabled={busy || uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={busy || uploading || (!!product && !dirty)}
              >
                <Save size={16} />
                {busy ? "Saving…" : uploading ? "Uploading…" : "Save product"}
              </button>
            </div>
          </div>
        </form>
        <aside className="product-preview-desktop">
          {photoPreview()}
          <div className="product-preview-help">
            <Leaf size={18} />
            <p>
              Clear names, useful photos and accurate pack labels make shopping
              easier.
            </p>
          </div>
        </aside>
      </div>
      <details className="product-preview-mobile">
        <summary>
          <Eye size={16} />
          Preview your product <ChevronDown size={15} />
        </summary>
        {photoPreview()}
      </details>
    </div>
  );
}
