"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  Leaf,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { api } from "@/lib/client-api";
import type { Product } from "@/lib/catalog";
import type { StoreSettings, Review, SupportTicket } from "@/lib/storefront";
import type { Order } from "@/lib/orders";
import { formatDelivery, orderTime } from "@/lib/orders";
import { money } from "@/lib/commerce";
import { ProductImage } from "./ui";
type Overview = {
  support: SupportTicket[];
  products: Product[];
  orders: Order[];
  settings: StoreSettings;
  reviews: Review[];
  metrics: {
    orders: number;
    revenue: number;
    delivered: number;
    pending: number;
    lowStock: number;
  };
  storage: string;
};
const nextStatuses: Record<string, string[]> = {
  placed: ["preparing", "cancelled"],
  preparing: ["out-for-delivery", "cancelled"],
  "out-for-delivery": ["delivered"],
  delivered: [],
  cancelled: [],
};
const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "products", label: "Products & stock", icon: Boxes },
  { id: "orders", label: "Orders", icon: Package },
  { id: "storefront", label: "Storefront settings", icon: Settings2 },
  { id: "reviews", label: "Customer reviews", icon: MessageSquare },
  { id: "support", label: "Customer support", icon: MessageSquare },
];
export function AdminPage() {
  const { user, ready } = useAccount();
  const [data, setData] = useState<Overview | null>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Product | null | undefined>(undefined),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await api<Overview>("/admin/overview"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user?.id, user?.role]);
  async function updateStatus(reference: string, status: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/orders/${reference}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <div className="page-container loading-state">Checking your account…</div>
    );
  if (user?.role !== "admin")
    return (
      <div className="page-container empty-state">
        <ShieldCheck size={46} />
        <h1>Store administration</h1>
        <p>
          {user
            ? "Your account does not have administrator access."
            : "Sign in with an administrator account to manage the store."}
        </p>
        <Link className="button primary" href="/account">
          Open account <ChevronRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <Leaf size={24} /> FreshCart <small>STORE MANAGER</small>
        </Link>
        <nav aria-label="Administration">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={id === tab ? "active" : ""}
              onClick={() => {
                setTab(id);
                setQuery("");
                setStatus("");
                setEditing(undefined);
              }}
            >
              <Icon size={19} />
              {label}
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>
        <div className="admin-person">
          <span className="round-icon">
            <ShieldCheck size={19} />
          </span>
          <strong>{user.name}</strong>
          <small>Administrator</small>
          <Link href="/">Visit storefront ↗</Link>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-heading">
          <div>
            <span className="eyebrow">YOUR STORE, AT A GLANCE</span>
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
            <p>Good food starts with a well-run store.</p>
          </div>
          <button className="button outline" onClick={load} disabled={busy}>
            <RefreshCw size={16} /> Refresh
          </button>
        </header>
        {error && (
          <p className="form-error admin-alert" role="alert">
            {error}
          </p>
        )}
        {!data ? (
          <div className="loading-state">
            {busy
              ? "Loading your store…"
              : "Store data is unavailable. Use Refresh to retry."}
          </div>
        ) : (
          <>
            <div
              className={`storage-banner ${data.storage === "demo" ? "demo" : ""}`}
            >
              <ShieldCheck size={16} />
              {data.storage === "demo"
                ? "Local demo data · Orders do not schedule real delivery."
                : "MongoDB connected"}
              <span>Online payments are verified by the gateway.</span>
            </div>
            {tab === "overview" && (
              <>
                <div className="metric-grid">
                  {[
                    {
                      label: "All orders",
                      value: data.metrics.orders,
                      icon: ShoppingBag,
                    },
                    {
                      label: "Awaiting fulfilment",
                      value: data.metrics.pending,
                      icon: Package,
                    },
                    {
                      label: "Delivered revenue",
                      value: money(data.metrics.revenue),
                      icon: BarChart3,
                    },
                    {
                      label: "Low-stock products",
                      value: data.metrics.lowStock,
                      icon: Boxes,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <article className="metric-card" key={label}>
                      <span className="round-icon">
                        <Icon size={22} />
                      </span>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                <p className="muted">
                  Revenue includes completed real deliveries; demo and sandbox
                  orders are excluded.
                </p>
                <div className="admin-overview-grid">
                  <section className="surface-card">
                    <div className="card-title">
                      <h2>Latest orders</h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("orders")}
                      >
                        View all →
                      </button>
                    </div>
                    {data.orders.slice(0, 5).map((o) => (
                      <div className="admin-list-row" key={o.reference}>
                        <span>
                          <strong>{o.reference}</strong>
                          <small>
                            {o.customer.name} · {orderTime(o.createdAt)}
                          </small>
                        </span>
                        <span className={`order-status status-${o.status}`}>
                          {o.status}
                        </span>
                        <b>{money(o.total)}</b>
                      </div>
                    ))}
                    {!data.orders.length && (
                      <p className="quiet-empty">
                        Your first order will appear here.
                      </p>
                    )}
                  </section>
                  <section className="surface-card">
                    <h2>Stock to keep an eye on</h2>
                    {data.products
                      .filter((p) => p.stock <= 5 && p.active !== false)
                      .slice(0, 6)
                      .map((p) => (
                        <button
                          className="admin-stock-row"
                          key={p.id}
                          onClick={() => {
                            setTab("products");
                            setEditing(p);
                          }}
                        >
                          <ProductImage product={p} />
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.unit}</small>
                          </span>
                          <b>{p.stock} left</b>
                        </button>
                      ))}
                    {!data.metrics.lowStock && (
                      <p className="quiet-empty">
                        <Check size={20} /> All active products have healthy
                        stock.
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
            {tab === "products" &&
              (editing !== undefined ? (
                <ProductEditor
                  product={editing}
                  catalog={data.products}
                  categories={data.settings.categories}
                  onCancel={() => setEditing(undefined)}
                  onSave={async (p) => {
                    await api(`/admin/products/${p.id}`, {
                      method: "PUT",
                      body: JSON.stringify(p),
                    });
                    setEditing(undefined);
                    await load();
                  }}
                />
              ) : (
                <>
                  <div className="admin-toolbar">
                    <label>
                      <Search size={17} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find a product or SKU"
                        aria-label="Find products"
                      />
                    </label>
                    <button
                      className="button primary"
                      onClick={() => setEditing(null)}
                    >
                      <Plus size={17} /> Add product
                    </button>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Product / SKU</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.products
                          .filter((p) =>
                            `${p.name} ${p.id}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div className="admin-product-cell">
                                  <ProductImage product={p} />
                                  <span>
                                    <strong>{p.name}</strong>
                                    <small>
                                      {p.unit} · {p.id}
                                      {p.parentId ? " · Variant" : ""}
                                    </small>
                                  </span>
                                </div>
                              </td>
                              <td>{p.category}</td>
                              <td>{money(p.price)}</td>
                              <td>
                                <span
                                  className={p.stock <= 5 ? "low-stock" : ""}
                                >
                                  {p.stock}
                                </span>
                              </td>
                              <td>
                                {p.active === false ? "Hidden" : "Active"}
                              </td>
                              <td>
                                <button
                                  className="button outline small"
                                  onClick={() => setEditing(p)}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ))}
            {tab === "orders" && (
              <>
                <div className="admin-toolbar">
                  <label>
                    <Search size={17} />
                    <input
                      placeholder="Search order or customer"
                      aria-label="Search orders"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter order status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {Object.keys(nextStatuses).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-order-list">
                  {data.orders
                    .filter(
                      (o) =>
                        (!status || o.status === status) &&
                        `${o.reference} ${o.customer.name} ${o.customer.phone}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .map((o) => (
                      <article className="surface-card" key={o.reference}>
                        <div className="card-title">
                          <div>
                            <Link href={`/orders/${o.reference}`}>
                              <strong>#{o.reference}</strong>
                            </Link>
                            <p>
                              {orderTime(o.createdAt)} ·{" "}
                              {o.mode === "demo"
                                ? "Demo order"
                                : o.sandbox
                                  ? "Sandbox payment"
                                  : "Customer order"}
                            </p>
                          </div>
                          <span className={`order-status status-${o.status}`}>
                            {o.status}
                          </span>
                        </div>
                        <div className="admin-order-details">
                          <div>
                            <strong>{o.customer.name}</strong>
                            <p>{o.customer.phone}</p>
                            <p>
                              {o.customer.address}, {o.customer.area}
                            </p>
                            <small>{formatDelivery(o.deliverySelection)}</small>
                            {o.instructions && <p>Note: {o.instructions}</p>}
                          </div>
                          <div>
                            {o.items.map((i) => (
                              <p key={i.productId}>
                                {i.quantity} × {i.name}{" "}
                                <small>({i.unit})</small>{" "}
                                <b>{money(i.price * i.quantity)}</b>
                              </p>
                            ))}
                            <strong>Total {money(o.total)}</strong>
                            <p>
                              {o.payment === "online"
                                ? `Online · ${o.paymentStatus}`
                                : "Cash on delivery"}
                            </p>
                          </div>
                        </div>
                        <div className="inline-actions">
                          {nextStatuses[o.status].map((s) => (
                            <button
                              key={s}
                              className={`button ${s === "cancelled" ? "outline" : "primary"} small`}
                              disabled={busy}
                              onClick={() => updateStatus(o.reference, s)}
                            >
                              {s === "cancelled"
                                ? "Cancel & restore stock"
                                : `Mark ${s.replaceAll("-", " ")}`}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                </div>
              </>
            )}
            {tab === "storefront" && (
              <SettingsEditor
                key={JSON.stringify(data.settings)}
                initial={data.settings}
                products={data.products}
                onSave={async (settings) => {
                  await api("/admin/settings", {
                    method: "PUT",
                    body: JSON.stringify(settings),
                  });
                  await load();
                }}
              />
            )}
            {tab === "support" && (
              <div className="admin-order-list">
                {!data.support.length && (
                  <div className="surface-card quiet-empty">
                    No support requests yet.
                  </div>
                )}
                {data.support.map((ticket) => (
                  <article className="surface-card" key={ticket.id}>
                    <div className="card-title">
                      <strong>
                        {ticket.reference} · {ticket.name}
                      </strong>
                      <span className="filter-chip">{ticket.status}</span>
                    </div>
                    <p>{ticket.message}</p>
                    <small>{orderTime(ticket.createdAt)}</small>
                    <div className="inline-actions">
                      <button
                        className="button outline small"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api(`/admin/support/${ticket.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                status:
                                  ticket.status === "open"
                                    ? "resolved"
                                    : "open",
                              }),
                            });
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                            setBusy(false);
                          }
                        }}
                      >
                        {ticket.status === "open"
                          ? "Mark resolved"
                          : "Reopen request"}
                      </button>
                      <Link
                        className="button outline small"
                        href={`/orders/${ticket.reference}`}
                      >
                        View order
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {tab === "reviews" && (
              <div className="admin-order-list">
                {!data.reviews.length && (
                  <div className="surface-card quiet-empty">
                    No customer reviews to moderate yet.
                  </div>
                )}
                {data.reviews.map((r) => (
                  <article className="surface-card" key={r.id}>
                    <div className="card-title">
                      <strong>
                        {data.products.find((p) => p.id === r.productId)
                          ?.name || r.productId}
                      </strong>
                      <span className="filter-chip">{r.status}</span>
                    </div>
                    <span className="review-stars">{"★".repeat(r.rating)}</span>
                    <p>{r.text}</p>
                    <small>
                      {r.author} · Verified purchase · {r.reference}
                    </small>
                    <div className="inline-actions">
                      {["approved", "rejected", "pending"]
                        .filter((s) => s !== r.status)
                        .map((s) => (
                          <button
                            className="button outline small"
                            key={s}
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await api(`/admin/reviews/${r.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ status: s }),
                                });
                                await load();
                              } catch (e) {
                                setError((e as Error).message);
                                setBusy(false);
                              }
                            }}
                          >
                            {s === "approved"
                              ? "Publish"
                              : s === "rejected"
                                ? "Reject"
                                : "Move to pending"}
                          </button>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ProductEditor({
  product,
  catalog,
  categories,
  onCancel,
  onSave,
}: {
  product: Product | null;
  catalog: Product[];
  categories: StoreSettings["categories"];
  onCancel: () => void;
  onSave: (p: Product) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();
    const price = Number(form.get("price"));
    const p: Product = {
      id: text("id"),
      slug: text("slug"),
      name: text("name"),
      category: text("category"),
      unit: text("unit"),
      price,
      atlas: Number(form.get("atlas")),
      stock: Number(form.get("stock")),
      description: text("description"),
      version: product?.version || 0,
      rating: 0,
      brand: text("brand"),
      dietary: text("dietary")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      origin: text("origin"),
      nutrition: text("nutrition"),
      allergens: text("allergens"),
      storage: text("storage"),
      imageUrl: text("imageUrl"),
      seasonal: form.has("seasonal"),
      organic: form.has("organic"),
      active: form.has("active"),
      ...(text("originalPrice")
        ? { originalPrice: Number(text("originalPrice")) }
        : {}),
      ...(text("parentId") ? { parentId: text("parentId") } : {}),
      ...(text("measure")
        ? {
            measure: Number(text("measure")),
            measureUnit: text("measureUnit") as Product["measureUnit"],
          }
        : {}),
    };
    setBusy(true);
    setError("");
    try {
      await onSave(p);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="surface-card">
      <div className="card-title">
        <div>
          <h2>{product ? "Edit product" : "Add a fresh find"}</h2>
          <p>Each pack size is a SKU with its own price and stock.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close product editor"
          onClick={onCancel}
        >
          <X />
        </button>
      </div>
      <form className="enhance-form" onSubmit={submit}>
        <div className="form-grid">
          {[
            { key: "id", label: "SKU / product ID", required: true },
            { key: "slug", label: "Product URL slug", required: true },
            { key: "name", label: "Product name", required: true },
            { key: "unit", label: "Pack label (e.g. 500 g)", required: true },
            { key: "brand", label: "Brand (leave blank if unknown)" },
          ].map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                name={f.key}
                defaultValue={String(product?.[f.key as keyof Product] || "")}
                required={f.required}
                readOnly={f.key === "id" && !!product}
                pattern={
                  ["id", "slug"].includes(f.key)
                    ? "[a-z0-9]+(-[a-z0-9]+)*"
                    : undefined
                }
                maxLength={f.key === "name" ? 120 : 80}
              />
            </label>
          ))}
          <label>
            Category
            <select
              name="category"
              defaultValue={product?.category || categories[0]?.slug}
            >
              {[
                ...new Map(
                  [
                    ...categories,
                    ...(product
                      ? [
                          {
                            slug: product.category,
                            name: product.category,
                            atlas: 0,
                          },
                        ]
                      : []),
                  ].map((c) => [c.slug, c]),
                ).values(),
              ].map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Variant of
            <select name="parentId" defaultValue={product?.parentId || ""}>
              <option value="">Base product</option>
              {catalog
                .filter((p) => !p.parentId && p.id !== product?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          {[
            {
              key: "price",
              label: "Selling price (৳)",
              min: 0.01,
              required: true,
            },
            {
              key: "originalPrice",
              label: "Original price (optional)",
              min: 0.01,
            },
            { key: "stock", label: "Stock in packs", min: 0, required: true },
            {
              key: "measure",
              label: "Amount per pack (e.g. 0.5 kg)",
              min: 0.001,
            },
          ].map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type="number"
                name={f.key}
                step={
                  f.key === "stock"
                    ? "1"
                    : f.key === "measure"
                      ? "0.001"
                      : "0.01"
                }
                min={f.min}
                max={f.key === "stock" ? 100000 : 500000}
                required={f.required}
                defaultValue={
                  product?.[f.key as keyof Product] as number | undefined
                }
              />
            </label>
          ))}
          <label>
            Unit for comparison
            <select
              name="measureUnit"
              defaultValue={product?.measureUnit || "kg"}
            >
              <option value="kg">Kilogram</option>
              <option value="litre">Litre</option>
              <option value="piece">Piece</option>
            </select>
          </label>
          <label>
            Dietary tags (comma separated)
            <input
              name="dietary"
              defaultValue={product?.dietary?.join(", ")}
              maxLength={320}
            />
          </label>
          <label>
            Country / region of origin
            <input
              name="origin"
              defaultValue={product?.origin}
              maxLength={150}
            />
          </label>
          <label>
            Image URL (HTTPS)
            <input
              name="imageUrl"
              type="url"
              defaultValue={product?.imageUrl}
              placeholder="https://…"
            />
          </label>
          <label>
            Bundled photo fallback
            <select name="atlas" defaultValue={product?.atlas || 0}>
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
              ].map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {[
          { key: "description", label: "Description", max: 2000 },
          {
            key: "nutrition",
            label: "Supplier nutrition information",
            max: 1500,
          },
          { key: "allergens", label: "Allergen information", max: 1000 },
          { key: "storage", label: "Storage instructions", max: 1000 },
        ].map((f) => (
          <label key={f.key}>
            {f.label}
            <textarea
              name={f.key}
              defaultValue={(product?.[f.key as keyof Product] as string) || ""}
              maxLength={f.max}
              rows={3}
            />
          </label>
        ))}
        <div className="checkbox-row">
          {[
            {
              key: "active",
              label: "Visible in store",
              checked: product?.active !== false,
            },
            {
              key: "seasonal",
              label: "Feature as seasonal",
              checked: product?.seasonal,
            },
            {
              key: "organic",
              label: "Verified organic",
              checked: product?.organic,
            },
          ].map((f) => (
            <label key={f.key}>
              <input type="checkbox" name={f.key} defaultChecked={f.checked} />
              {f.label}
            </label>
          ))}
        </div>
        <p className="muted">
          Enter supplier facts only. Leave unknown nutrition, origin and
          allergen details empty.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="inline-actions">
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save product"}
          </button>
          <button type="button" className="button outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function SettingsEditor({
  initial,
  products,
  onSave,
}: {
  initial: StoreSettings;
  products: Product[];
  onSave: (settings: StoreSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const patch = (value: Partial<StoreSettings>) =>
    setDraft((d) => ({ ...d, ...value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="enhance-form settings-form" onSubmit={submit}>
      <section className="surface-card">
        <h2>Homepage sections</h2>
        <p>Choose the shelves your customers see.</p>
        <div className="checkbox-row">
          {Object.entries(draft.homeSections).map(([key, value]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) =>
                  patch({
                    homeSections: {
                      ...draft.homeSections,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              {key}
            </label>
          ))}
        </div>
      </section>
      <section className="surface-card">
        <div className="card-title">
          <h2>Categories</h2>
          <button
            className="button outline small"
            type="button"
            onClick={() =>
              patch({
                categories: [
                  ...draft.categories,
                  {
                    slug: `category-${draft.categories.length + 1}`,
                    name: "New category",
                    atlas: 0,
                  },
                ],
              })
            }
          >
            <Plus size={15} /> Add category
          </button>
        </div>
        {draft.categories.map((c, i) => (
          <div className="settings-row" key={i}>
            <label>
              Name
              <input
                required
                value={c.name}
                onChange={(e) =>
                  patch({
                    categories: draft.categories.map((v, n) =>
                      n === i ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Category slug
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={c.slug}
                onChange={(e) =>
                  patch({
                    categories: draft.categories.map((v, n) =>
                      n === i ? { ...v, slug: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Photo tile
              <select
                value={c.atlas}
                onChange={(e) =>
                  patch({
                    categories: draft.categories.map((v, n) =>
                      n === i ? { ...v, atlas: Number(e.target.value) } : v,
                    ),
                  })
                }
              >
                {products
                  .filter((p) => !p.parentId)
                  .map((p) => (
                    <option key={p.id} value={p.atlas}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove category ${c.name}`}
              onClick={() =>
                patch({
                  categories: draft.categories.filter((_, n) => n !== i),
                })
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </section>
      <section className="surface-card">
        <h2>Delivery coverage & charges</h2>
        <label>
          Free delivery from (৳)
          <input
            type="number"
            min={1}
            required
            value={draft.freeDeliveryAt}
            onChange={(e) => patch({ freeDeliveryAt: Number(e.target.value) })}
          />
        </label>
        {draft.zones.map((z, i) => (
          <div className="settings-row" key={z.name}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={z.enabled}
                onChange={(e) =>
                  patch({
                    zones: draft.zones.map((v, n) =>
                      n === i ? { ...v, enabled: e.target.checked } : v,
                    ),
                  })
                }
              />
              {z.name}
            </label>
            <label>
              Delivery fee (৳)
              <input
                type="number"
                min={0}
                max={1000}
                required
                value={z.fee}
                onChange={(e) =>
                  patch({
                    zones: draft.zones.map((v, n) =>
                      n === i ? { ...v, fee: Number(e.target.value) } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Delivery note
              <input
                required
                maxLength={160}
                value={z.estimate}
                onChange={(e) =>
                  patch({
                    zones: draft.zones.map((v, n) =>
                      n === i ? { ...v, estimate: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
        <h3>Available time slots (Dhaka time)</h3>
        <div className="checkbox-row">
          {draft.slots.map((s, i) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) =>
                  patch({
                    slots: draft.slots.map((v, n) =>
                      n === i ? { ...v, enabled: e.target.checked } : v,
                    ),
                  })
                }
              />
              {s.id === "morning"
                ? "10 AM – 12 PM"
                : s.id === "afternoon"
                  ? "12 PM – 2 PM"
                  : "4 PM – 6 PM"}
            </label>
          ))}
        </div>
      </section>
      <section className="surface-card">
        <div className="card-title">
          <h2>Promo codes</h2>
          <button
            type="button"
            className="button outline small"
            onClick={() =>
              patch({
                promos: [
                  ...draft.promos,
                  {
                    code: "NEWCODE",
                    percent: 10,
                    maxDiscount: 100,
                    active: false,
                  },
                ],
              })
            }
          >
            <Plus size={15} /> Add code
          </button>
        </div>
        {draft.promos.map((p, i) => (
          <div className="settings-row" key={i}>
            <label>
              Code
              <input
                value={p.code}
                pattern="[A-Z0-9]{3,20}"
                required
                onChange={(e) =>
                  patch({
                    promos: draft.promos.map((v, n) =>
                      n === i
                        ? { ...v, code: e.target.value.toUpperCase() }
                        : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Discount %
              <input
                type="number"
                min={0}
                max={100}
                value={p.percent}
                onChange={(e) =>
                  patch({
                    promos: draft.promos.map((v, n) =>
                      n === i ? { ...v, percent: Number(e.target.value) } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Maximum discount (৳)
              <input
                type="number"
                min={0}
                max={50000}
                value={p.maxDiscount}
                onChange={(e) =>
                  patch({
                    promos: draft.promos.map((v, n) =>
                      n === i
                        ? { ...v, maxDiscount: Number(e.target.value) }
                        : v,
                    ),
                  })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={p.active}
                onChange={(e) =>
                  patch({
                    promos: draft.promos.map((v, n) =>
                      n === i ? { ...v, active: e.target.checked } : v,
                    ),
                  })
                }
              />
              Active
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove promo ${p.code}`}
              onClick={() =>
                patch({ promos: draft.promos.filter((_, n) => n !== i) })
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </section>
      <section className="surface-card">
        <div className="card-title">
          <h2>Everyday bundles</h2>
          <button
            type="button"
            className="button outline small"
            onClick={() =>
              patch({
                bundles: [
                  ...draft.bundles,
                  {
                    id: `bundle-${Date.now()}`,
                    name: "New basket",
                    description: "",
                    active: false,
                    items: [{ productId: products[0]?.id || "", quantity: 1 }],
                  },
                ],
              })
            }
          >
            <Plus size={15} /> Add bundle
          </button>
        </div>
        {draft.bundles.map((b, i) => {
          const edit = (value: Partial<typeof b>) =>
            patch({
              bundles: draft.bundles.map((v, n) =>
                n === i ? { ...v, ...value } : v,
              ),
            });
          return (
            <details className="bundle-editor" key={b.id}>
              <summary>
                {b.name} · {b.items.length} products
              </summary>
              <label>
                Name
                <input
                  required
                  value={b.name}
                  onChange={(e) => edit({ name: e.target.value })}
                />
              </label>
              <label>
                Description
                <input
                  maxLength={300}
                  value={b.description}
                  onChange={(e) => edit({ description: e.target.value })}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={b.active}
                  onChange={(e) => edit({ active: e.target.checked })}
                />
                Visible on homepage
              </label>
              {b.items.map((item, n) => (
                <div className="settings-row" key={n}>
                  <label>
                    Product
                    <select
                      value={item.productId}
                      onChange={(e) =>
                        edit({
                          items: b.items.map((v, j) =>
                            j === n ? { ...v, productId: e.target.value } : v,
                          ),
                        })
                      }
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={item.quantity}
                      onChange={(e) =>
                        edit({
                          items: b.items.map((v, j) =>
                            j === n
                              ? { ...v, quantity: Number(e.target.value) }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove bundle product"
                    onClick={() =>
                      edit({ items: b.items.filter((_, j) => j !== n) })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="inline-actions">
                <button
                  type="button"
                  className="button outline small"
                  onClick={() =>
                    edit({
                      items: [
                        ...b.items,
                        { productId: products[0]?.id || "", quantity: 1 },
                      ],
                    })
                  }
                >
                  Add product
                </button>
                <button
                  type="button"
                  className="button outline small"
                  onClick={() =>
                    patch({ bundles: draft.bundles.filter((_, n) => n !== i) })
                  }
                >
                  Remove bundle
                </button>
              </div>
            </details>
          );
        })}
      </section>
      <section className="surface-card">
        <div className="card-title">
          <h2>Frequently asked questions</h2>
          <button
            type="button"
            className="button outline small"
            onClick={() =>
              patch({
                faqs: [...draft.faqs, { question: "New question", answer: "" }],
              })
            }
          >
            <Plus size={15} /> Add FAQ
          </button>
        </div>
        {draft.faqs.map((f, i) => (
          <div className="faq-editor" key={i}>
            <label>
              Question
              <input
                required
                minLength={5}
                maxLength={200}
                value={f.question}
                onChange={(e) =>
                  patch({
                    faqs: draft.faqs.map((v, n) =>
                      n === i ? { ...v, question: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Answer
              <textarea
                required
                minLength={5}
                maxLength={1500}
                value={f.answer}
                onChange={(e) =>
                  patch({
                    faqs: draft.faqs.map((v, n) =>
                      n === i ? { ...v, answer: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                patch({ faqs: draft.faqs.filter((_, n) => n !== i) })
              }
            >
              Remove question
            </button>
          </div>
        ))}
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success-message" role="status">
          Storefront settings saved.
        </p>
      )}
      <div className="settings-save">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save storefront settings"}
          <Check size={17} />
        </button>
        <p>Changes apply on the next storefront refresh.</p>
      </div>
    </form>
  );
}
