"use client";
import { useStoreFormat } from "./store-format";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Download,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/client-api";

import { type Order } from "@/lib/orders";
import type { Product } from "@/lib/catalog";
import type { Account, SupportTicket, Review } from "@/lib/storefront";
import {
  can,
  type ContentConfig,
  type AuditEvent,
  type StockEvent,
  type SalesReport,
  type ReturnRequest,
  type CaseMeta,
  type OrderOperations,
} from "@/lib/management";
import { exportProducts, importProducts } from "@/lib/product-csv";
import { Notice, useUnsaved } from "./admin-shared";
import { Modal } from "./ui";
export function ReportsPanel() {
  const { money } = useStoreFormat();
  const [days, setDays] = useState(7),
    [mode, setMode] = useState("live"),
    [report, setReport] = useState<SalesReport>(),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setReport(undefined);
    void api<{ report: SalesReport }>(
      `/admin/reports?days=${days}&mode=${mode}`,
    )
      .then((r) => {
        if (alive) {
          setReport(r.report);
          setError("");
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [days, mode]);
  return (
    <div className="management-stack">
      <div className="surface-card management-toolbar">
        <div>
          <span className="eyebrow">A CLEARER PICTURE</span>
          <h2>Sales & promo performance</h2>
          <p>
            Order dates use the configured store time zone. Sales include
            delivered COD and verified online payments, before refunds.
          </p>
        </div>
        <div className="inline-actions">
          <label>
            Period
            <select
              aria-label="Report period"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
          <label>
            Order source
            <select
              aria-label="Report source"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="live">Customer orders only</option>
              <option value="demo">Demo & sandbox</option>
            </select>
          </label>
        </div>
      </div>
      <Notice error={error} />
      {!report ? (
        <p role="status">Loading report…</p>
      ) : (
        <>
          <div className="management-metrics">
            {[
              ["Orders", report.current.orders, report.previous.orders],
              [
                "Delivered",
                report.current.delivered,
                report.previous.delivered,
              ],
              [
                "Delivered sales",
                report.current.revenue,
                report.previous.revenue,
              ],
              [
                "Promo discounts",
                report.current.discount,
                report.previous.discount,
              ],
            ].map(([label, current, previous]) => (
              <article key={String(label)}>
                <span>{label}</span>
                <strong>
                  {String(label).includes("sales") ||
                  String(label).includes("discount")
                    ? money(Number(current))
                    : current}
                </strong>
                <small>
                  Previous period:{" "}
                  {String(label).includes("sales") ||
                  String(label).includes("discount")
                    ? money(Number(previous))
                    : previous}
                </small>
                <em>
                  {Number(previous)
                    ? `${(((Number(current) - Number(previous)) / Number(previous)) * 100).toFixed(1)}% change`
                    : "No prior-period baseline"}
                </em>
              </article>
            ))}
          </div>
          <section className="surface-card">
            <div className="card-title">
              <h2>Daily delivered sales</h2>
              <span>
                {mode === "live" ? "Customer orders" : "Demo / sandbox"}
              </span>
            </div>
            <div
              className="sales-chart"
              role="img"
              aria-label={`Daily sales for ${days} days: ${report.daily.map((d) => `${d.date}: ${money(d.revenue)}`).join("; ")}`}
            >
              {report.daily.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${money(day.revenue)} · ${day.orders} orders`}
                >
                  <span
                    style={{
                      height: `${day.revenue ? Math.max(3, (day.revenue / Math.max(1, ...report.daily.map((d) => d.revenue))) * 150) : 0}px`,
                    }}
                  />
                  <small>{day.date.slice(5)}</small>
                </div>
              ))}
            </div>
            {!report.current.revenue && (
              <p className="quiet-empty">
                No delivered sales in this period and source.
              </p>
            )}
          </section>
          <section className="surface-card">
            <h2>Promo code results</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Applied orders</th>
                    <th>Delivered orders</th>
                    <th>Total discount</th>
                    <th>Delivered sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.promos.map((p) => (
                    <tr key={p.code}>
                      <td>{p.code}</td>
                      <td>{p.uses}</td>
                      <td>{p.completed}</td>
                      <td>{money(p.discount)}</td>
                      <td>{money(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!report.promos.length && (
              <p className="quiet-empty">
                No promo orders in this period. Historical orders without a
                saved promo code cannot be attributed.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
export function InventoryPanel({ products }: { products: Product[] }) {
  const { orderTime } = useStoreFormat();
  const [data, setData] = useState<{
      threshold: number;
      alerts: Product[];
      events: StockEvent[];
    }>(),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    void api<typeof data>("/admin/inventory")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [products]);
  return (
    <div className="management-stack">
      <Notice error={error} />
      <section className="surface-card">
        <span className="eyebrow">KEEP THE SHELVES READY</span>
        <h2>Low stock alerts</h2>
        <p>
          Default threshold: {data?.threshold ?? "…"} packs. Set a
          product-specific threshold in its editor, or change the default under
          Search & alerts.
        </p>
        <div className="inventory-alert-grid">
          {data?.alerts.map((p) => (
            <article key={p.id}>
              <strong>{p.name}</strong>
              <small>{p.unit}</small>
              <span className="management-badge warning">
                {p.stock} remaining · alert at{" "}
                {p.lowStockThreshold ?? data.threshold}
              </span>
            </article>
          ))}
        </div>
        {data && !data.alerts.length && (
          <p className="quiet-empty">
            All active products are above their alert thresholds.
          </p>
        )}
      </section>
      <section className="surface-card">
        <div className="card-title">
          <h2>Stock movement history</h2>
          <input
            aria-label="Find stock movements"
            placeholder="SKU, reason or staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Product</th>
                <th>Before → after</th>
                <th>Change</th>
                <th>Reason / actor</th>
              </tr>
            </thead>
            <tbody>
              {data?.events
                .filter((e) =>
                  `${e.productId} ${e.reason} ${e.actor}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((e) => (
                  <tr key={e.id}>
                    <td>{orderTime(e.at)}</td>
                    <td>
                      {products.find((p) => p.id === e.productId)?.name ||
                        e.productId}
                      <small>{e.productId}</small>
                    </td>
                    <td>
                      {e.before} → {e.after}
                    </td>
                    <td>
                      {e.after - e.before > 0 ? "+" : ""}
                      {e.after - e.before}
                    </td>
                    <td>
                      {e.reason}
                      <small>{e.actor}</small>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!data?.events.length && (
          <p className="quiet-empty">
            Movements will appear as products, checkout reservations,
            cancellations or inspected returns change stock.
          </p>
        )}
      </section>
    </div>
  );
}
export function ActivityPanel() {
  const { orderTime } = useStoreFormat();
  const [events, setEvents] = useState<AuditEvent[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    void api<{ events: AuditEvent[] }>("/admin/activity")
      .then((r) => setEvents(r.events))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="surface-card">
      <div className="card-title">
        <div>
          <span className="eyebrow">WHO CHANGED WHAT</span>
          <h2>Activity history</h2>
        </div>
        <input
          aria-label="Find activity"
          placeholder="Search staff, action or reference…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Notice error={error} />
      <div className="activity-feed">
        {events
          .filter((e) =>
            `${e.actor} ${e.action} ${e.target} ${e.detail}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((e) => (
            <article key={e.id}>
              <span className="activity-dot" />
              <div>
                <strong>{e.action.replaceAll(".", " · ")}</strong>
                <p>{e.detail}</p>
                <small>
                  {e.actor} · {e.target} · {orderTime(e.at)}
                </small>
              </div>
            </article>
          ))}
      </div>
      {!events.length && (
        <p className="quiet-empty">
          New administrative actions are recorded here. Earlier changes have no
          fabricated history.
        </p>
      )}
    </section>
  );
}
export function TeamPanel() {
  const [pending, setPending] = useState<{ user: Account; role: string }>();
  const [users, setUsers] = useState<Account[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [success, setSuccess] = useState("");
  async function load() {
    setUsers((await api<{ users: Account[] }>("/admin/team")).users);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <section className="surface-card">
      <span className="eyebrow">THE RIGHT TOOLS FOR EACH PERSON</span>
      <h2>Staff & permissions</h2>
      <p>
        Assign roles to registered accounts. Administrators manage access;
        managers run the store; editors manage products, content and reviews;
        fulfilment staff manage orders and support.
      </p>
      <input
        aria-label="Find team accounts"
        placeholder="Search registered name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Notice error={error} success={success} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Current role</th>
              <th>Assign role</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((u) =>
                `${u.name} ${u.email}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <span className="management-badge">{u.role}</span>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      disabled={!!busy}
                      onChange={(e) =>
                        setPending({ user: u, role: e.target.value })
                      }
                    >
                      {[
                        "customer",
                        "admin",
                        "manager",
                        "editor",
                        "fulfilment",
                      ].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {pending && (
        <Modal
          title="Review staff access"
          onClose={() => {
            if (!busy) setPending(undefined);
          }}
        >
          <p className="modal-description">
            Change <strong>{pending.user.name}</strong> ({pending.user.email})
            from <strong>{pending.user.role}</strong> to{" "}
            <strong>{pending.role}</strong>. This changes which store tools and
            customer records they can access.
          </p>
          <Notice error={error} />
          <div className="inline-actions">
            <button
              className="button primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy(pending.user.id);
                setError("");
                setSuccess("");
                try {
                  await api(`/admin/team/${pending.user.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      expectedRole: pending.user.role,
                      role: pending.role,
                    }),
                  });
                  await load();
                  setPending(undefined);
                  setSuccess(
                    "Staff role updated. The new permissions apply to the next request.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              Confirm role change
            </button>
            <button
              className="button outline"
              disabled={!!busy}
              onClick={() => setPending(undefined)}
            >
              Keep current role
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
export function SearchSettings({
  initial,
  products,
  onSave,
}: {
  initial: ContentConfig;
  products: Product[];
  onSave: (c: ContentConfig) => Promise<ContentConfig>;
}) {
  const { orderTime } = useStoreFormat();
  const [draft, setDraft] = useState(structuredClone(initial)),
    [misses, setMisses] = useState<
      { query: string; count: number; lastAt: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const { markDirty, clean } = useUnsaved();
  useEffect(() => {
    void api<{ misses: typeof misses }>("/admin/search-misses")
      .then((r) => setMisses(r.misses))
      .catch((e) => setError(e.message));
    return () => clean();
  }, []);
  return (
    <form
      className="enhance-form management-editor"
      onChange={markDirty}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          setDraft(await onSave(draft));
          clean();
          setSuccess("Search aliases and stock alert settings saved.");
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
            <h2>Search words & alternatives</h2>
            <p>
              The built-in Bengali–English vocabulary stays available. Add local
              names or alternative spellings here.
            </p>
          </div>
          <button
            className="button outline small"
            type="button"
            disabled={draft.aliases.length >= 100}
            onClick={() => {
              setDraft((p) => ({
                ...p,
                aliases: [...p.aliases, { term: "", productIds: [] }],
              }));
              markDirty();
            }}
          >
            <Plus size={15} />
            Add search word
          </button>
        </div>
        {draft.aliases.map((alias, index) => (
          <div className="alias-row" key={index}>
            <label>
              Search word
              <input
                required
                minLength={2}
                maxLength={80}
                value={alias.term}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    aliases: p.aliases.map((a, i) =>
                      i === index ? { ...a, term: e.target.value } : a,
                    ),
                  }))
                }
              />
            </label>
            <label>
              Matching products (choose one or more)
              <select
                multiple
                required
                aria-label={`Products for ${alias.term || "new search word"}`}
                value={alias.productIds}
                onChange={(e) => {
                  const productIds = Array.from(e.target.selectedOptions).map(
                    (o) => o.value,
                  );
                  setDraft((p) => ({
                    ...p,
                    aliases: p.aliases.map((a, i) =>
                      i === index ? { ...a, productIds } : a,
                    ),
                  }));
                }}
              >
                {products.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · {p.unit}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove search word ${alias.term || index + 1}`}
              onClick={() => {
                setDraft((p) => ({
                  ...p,
                  aliases: p.aliases.filter((_, i) => i !== index),
                }));
                markDirty();
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!draft.aliases.length && (
          <p className="quiet-empty">No custom search words yet.</p>
        )}
      </section>
      <section className="surface-card">
        <h2>Stock warning threshold</h2>
        <label>
          Alert when a product has this many packs or fewer
          <input
            type="number"
            min={0}
            max={100000}
            required
            value={draft.lowStockThreshold}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                lowStockThreshold: Number(e.target.value),
              }))
            }
          />
        </label>
        <p className="muted">
          Individual products can override this threshold. Alerts appear in
          Inventory & alerts.
        </p>
      </section>
      <Notice error={error} success={success} />
      <div className="management-save">
        <button className="button primary" disabled={busy}>
          <Save size={16} />
          {busy ? "Saving…" : "Save search & alerts"}
        </button>
      </div>
      <section className="surface-card">
        <h2>Searches with no matches</h2>
        <p>
          Recorded from catalog searches that had no product matches. No
          customer identity is stored.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Search</th>
                <th>Count</th>
                <th>Last searched</th>
              </tr>
            </thead>
            <tbody>
              {misses.map((m) => (
                <tr key={m.query}>
                  <td>{m.query}</td>
                  <td>{m.count}</td>
                  <td>{orderTime(m.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!misses.length && (
          <p className="quiet-empty">
            No unsuccessful searches have been recorded yet.
          </p>
        )}
      </section>
    </form>
  );
}
export function CatalogTools({
  products,
  reload,
}: {
  products: Product[];
  reload: () => Promise<void>;
}) {
  const { money } = useStoreFormat();
  const [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [price, setPrice] = useState(""),
    [stock, setStock] = useState(""),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<Product[]>([]),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const filtered = products.filter((p) =>
    `${p.name} ${p.id} ${p.unit}`.toLowerCase().includes(query.toLowerCase()),
  );
  function download() {
    const blob = new Blob([exportProducts(products)], {
        type: "text/csv;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "freshcart-products.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function prepare(list: Product[]) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api<{ products: Product[] }>(
        "/admin/products/preview",
        { method: "POST", body: JSON.stringify({ products: list }) },
      );
      setPreview(result.products);
    } catch (e) {
      setError((e as Error).message);
      setPreview([]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="management-stack">
      <section className="surface-card">
        <div className="card-title">
          <div>
            <span className="eyebrow">A LITTLE LESS REPETITION</span>
            <h2>Bulk updates & CSV</h2>
            <p>
              Download a template, edit up to 100 SKUs and preview before
              applying. Version checks protect newer stock changes.
            </p>
          </div>
          <div className="inline-actions">
            <button className="button outline small" onClick={download}>
              <Download size={16} />
              Export CSV
            </button>
            <label className="button outline small">
              <Upload size={16} />
              Import CSV
              <input
                className="visually-hidden"
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 200000)
                      throw new Error("Choose a CSV under 200 KB.");
                    await prepare(importProducts(await file.text(), products));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </label>
          </div>
        </div>
        <input
          aria-label="Find bulk products"
          placeholder="Search products or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="bulk-controls">
          <label>
            Set selling price (optional)
            <input
              type="number"
              min={0.01}
              max={500000}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Adjust stock by packs (optional)
            <input
              type="number"
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="e.g. 5 or -2"
            />
          </label>
          <button
            className="button outline"
            disabled={busy || !selected.length || (!price && !stock)}
            onClick={() =>
              void prepare(
                products
                  .filter((p) => selected.includes(p.id))
                  .map((p) => ({
                    ...p,
                    ...(price ? { price: Number(price) } : {}),
                    ...(stock ? { stock: p.stock + Number(stock) } : {}),
                  })),
              )
            }
          >
            Preview {selected.length} updates <ArrowRight size={16} />
          </button>
        </div>
        <div className="bulk-product-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={
                !!filtered.length &&
                filtered.every((p) => selected.includes(p.id))
              }
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...new Set([...selected, ...filtered.map((p) => p.id)])]
                    : selected.filter(
                        (id) => !filtered.some((p) => p.id === id),
                      ),
                )
              }
            />
            Select filtered products
          </label>
          {filtered.map((p) => (
            <label className="checkbox-label" key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={(e) =>
                  setSelected((v) =>
                    e.target.checked
                      ? [...v, p.id]
                      : v.filter((id) => id !== p.id),
                  )
                }
              />
              <span>
                {p.name}
                <small>
                  {p.unit} · {money(p.price)} · {p.stock} in stock · {p.id}
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <Notice error={error} success={success} />
      {!!preview.length && (
        <section className="surface-card">
          <div className="card-title">
            <h2>Review {preview.length} product changes</h2>
            <button className="text-button" onClick={() => setPreview([])}>
              Discard preview
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Price: before → after</th>
                  <th>Stock: before → after</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => {
                  const old = products.find((v) => v.id === p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        {p.id}
                        {!old && <small>New SKU</small>}
                      </td>
                      <td>
                        {p.name}
                        <small>{p.unit}</small>
                      </td>
                      <td>
                        {old ? money(old.price) : "—"} → {money(p.price)}
                      </td>
                      <td>
                        {old?.stock ?? 0} → {p.stock}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Review all imported fields</summary>
            <pre className="import-details">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </details>
          <label>
            Reason for this batch
            <input
              required
              minLength={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Supplier delivery received"
            />
          </label>
          <button
            className="button primary"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("/admin/products/batch", {
                  method: "POST",
                  body: JSON.stringify({ products: preview, reason }),
                });
                await reload();
                setPreview([]);
                setSelected([]);
                setSuccess(
                  "All product changes saved. Stock movements and the batch reason were recorded.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            {busy ? "Applying…" : "Apply reviewed changes"}
          </button>
        </section>
      )}
    </div>
  );
}
export function OrderOperationsPanel({ reference }: { reference: string }) {
  const { orderTime } = useStoreFormat();
  const [data, setData] = useState<{
      operations: OrderOperations;
      picking?: {
        productId: string;
        batchNumber: string;
        expiresOn: string | null;
        quantity: number;
      }[];
      events: AuditEvent[];
    }>(),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(await api(`/admin/orders/${reference}/operations`));
  }
  useEffect(() => {
    setData(undefined);
  }, [reference]);
  return (
    <details
      className="order-operations"
      onToggle={(e) => {
        if (e.currentTarget.open && !data)
          void load().catch((e) => setError(e.message));
      }}
    >
      <summary>Batch picking, notes, history & printing</summary>
      {!!data?.picking?.length && (
        <section className="surface-card">
          <h3>Reserved batches for picking</h3>
          <p>
            Check the physical batch number and labelled expiry before packing.
            Quantities below are reserved product packs.
          </p>
          <ul>
            {data.picking.map((p, i) => (
              <li key={`${p.productId}-${p.batchNumber}-${i}`}>
                {p.quantity} × {p.productId} · Batch {p.batchNumber} ·{" "}
                {p.expiresOn || "No labelled expiry"}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="inline-actions">
        <a
          className="button outline small"
          href={`/admin/print/${reference}?kind=invoice`}
          target="_blank"
        >
          Print invoice ↗
        </a>
        <a
          className="button outline small"
          href={`/admin/print/${reference}?kind=packing`}
          target="_blank"
        >
          Packing list ↗
        </a>
        <button
          className="text-button"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          <RefreshCw size={13} />
          Refresh history
        </button>
      </div>
      <Notice error={error} />
      <div className="order-notes">
        {data?.operations.notes.map((n) => (
          <article key={n.id}>
            <p>{n.text}</p>
            <small>
              {n.actor} · {orderTime(n.at)}
            </small>
          </article>
        ))}
      </div>
      <form
        className="inline-actions"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!data) return;
          setBusy(true);
          setError("");
          try {
            await api(`/admin/orders/${reference}/notes`, {
              method: "POST",
              body: JSON.stringify({
                text: note,
                version: data.operations.version,
              }),
            });
            await load();
            setNote("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label={`Internal note for ${reference}`}
          value={note}
          minLength={2}
          maxLength={1000}
          required
          placeholder="Add an internal note…"
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="button outline small" disabled={busy || !data}>
          Save note
        </button>
      </form>
      <ol className="order-history">
        {data?.events.map((e) => (
          <li key={e.id}>
            <strong>{e.detail}</strong>
            <small>
              {e.actor} · {orderTime(e.at)}
            </small>
          </li>
        ))}
      </ol>
      {data && !data.events.length && (
        <p className="muted">
          No recorded history for this older order. Future changes will appear
          here.
        </p>
      )}
    </details>
  );
}
export function CaseTools({
  kind,
  id,
  createdAt,
  status,
}: {
  kind: "support" | "review";
  id: string;
  createdAt: string;
  status: string;
}) {
  const [data, setData] = useState<{
      cases: CaseMeta[];
      staff: Pick<Account, "id" | "name" | "role">[];
    }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(await api("/admin/cases"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [status]);
  const meta = data?.cases.find((c) => c.id === `${kind}:${id}`);
  async function update(value: Partial<CaseMeta>) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/cases/${kind}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: meta?.version || 0,
          priority: meta?.priority || "normal",
          assigneeId: meta?.assigneeId || "",
          ...value,
        }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="case-tools">
      <label>
        Priority
        <select
          aria-label={`Priority for ${id}`}
          value={meta?.priority || "normal"}
          disabled={busy || !data}
          onChange={(e) =>
            void update({ priority: e.target.value as CaseMeta["priority"] })
          }
        >
          {["low", "normal", "high"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        Assigned to
        <select
          aria-label={`Assignee for ${id}`}
          value={meta?.assigneeId || ""}
          disabled={busy || !data}
          onChange={(e) => void update({ assigneeId: e.target.value })}
        >
          <option value="">Unassigned</option>
          {data?.staff
            .filter((u) =>
              can(u.role, kind === "support" ? "support" : "reviews"),
            )
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </label>
      <small>
        {meta?.resolvedAt
          ? `Resolved in ${Math.max(0, Math.round((Date.parse(meta.resolvedAt) - Date.parse(createdAt)) / 60000))} minutes`
          : `Open ${Math.max(0, Math.round((Date.now() - Date.parse(createdAt)) / 3600000))} hours`}
      </small>
      <Notice error={error} />
    </div>
  );
}
const returnTransitions: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "refund-pending", "rejected"],
  received: ["refund-pending"],
  "refund-pending": ["refunded"],
};
export function ReturnsPanel({ products }: { products: Product[] }) {
  const [returns, setReturns] = useState<ReturnRequest[]>([]),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function load() {
    setReturns(
      (await api<{ returns: ReturnRequest[] }>("/admin/returns")).returns,
    );
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <div className="management-stack">
      <section className="surface-card management-toolbar">
        <div>
          <span className="eyebrow">CARE AFTER DELIVERY</span>
          <h2>Returns & refunds</h2>
          <p>
            Inspect returned goods before restocking. Refund status records a
            payment completed outside this panel; it does not send money
            automatically.
          </p>
        </div>
        <select
          aria-label="Return status filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            "requested",
            "approved",
            "received",
            "refund-pending",
            "refunded",
            "rejected",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </section>
      <Notice error={error} success={success} />
      {returns
        .filter((r) => !filter || r.status === filter)
        .map((r) => (
          <ReturnCard
            key={`${r.id}-${r.version}`}
            item={r}
            products={products}
            onSave={async (value) => {
              await api(`/admin/returns/${r.id}`, {
                method: "PATCH",
                body: JSON.stringify({ ...value, version: r.version }),
              });
              await load();
              setSuccess(
                "Return updated. Any refund remains subject to the recorded external payment.",
              );
            }}
          />
        ))}
      {!returns.length && (
        <p className="surface-card quiet-empty">
          Return requests from delivered orders will appear here.
        </p>
      )}
    </div>
  );
}
function ReturnCard({
  item,
  products,
  onSave,
}: {
  item: ReturnRequest;
  products: Product[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const { orderTime, money } = useStoreFormat();
  const [status, setStatus] = useState(
      returnTransitions[item.status]?.[0] || "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <article className="surface-card">
      <div className="card-title">
        <div>
          <h3>
            {item.reference} · {item.name}
          </h3>
          <small>
            {orderTime(item.createdAt)} · {item.id}
          </small>
        </div>
        <span
          className={`management-badge ${item.status === "refunded" ? "success" : "warning"}`}
        >
          {item.status}
        </span>
      </div>
      <p>{item.reason}</p>
      <ul>
        {item.items.map((i) => (
          <li key={i.productId}>
            {i.quantity} ×{" "}
            {products.find((p) => p.id === i.productId)?.name || i.productId}
          </li>
        ))}
      </ul>
      <p>
        <strong>Refund value: {money(item.amount)}</strong> · Product value
        after original discount, excluding delivery
      </p>
      <p>
        {item.restocked ? "Inspected stock restored." : "No stock restored."}
      </p>
      {item.notes && <p>Staff note: {item.notes}</p>}
      {item.refundReference && (
        <p>
          Recorded refund: {item.refundMethod} · {item.refundReference}
        </p>
      )}
      <details>
        <summary>Status history</summary>
        <ol className="order-history">
          {item.history.map((h, i) => (
            <li key={i}>
              <strong>{h.status}</strong>
              <small>
                {h.actor} · {orderTime(h.at)}
              </small>
            </li>
          ))}
        </ol>
      </details>
      {status && (
        <form
          className="enhance-form return-action-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              await onSave({
                status,
                notes: String(form.get("notes")),
                restock: status === "received" && form.has("restock"),
                refundMethod: String(form.get("method") || ""),
                refundReference: String(form.get("reference") || ""),
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Next status
              <select
                aria-label={`Next return status for ${item.id}`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {returnTransitions[item.status].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Decision / staff note
              <input name="notes" required minLength={3} maxLength={1000} />
            </label>
            {status === "received" && (
              <label className="checkbox-label">
                <input type="checkbox" name="restock" />
                Inspected and suitable for resale—restore these packs
              </label>
            )}
            {status === "refunded" && (
              <>
                <label>
                  Completed refund method
                  <input
                    name="method"
                    required
                    maxLength={80}
                    placeholder="e.g. Cash / bKash / merchant gateway"
                  />
                </label>
                <label>
                  External refund receipt / transaction reference
                  <input name="reference" required maxLength={120} />
                </label>
              </>
            )}
          </div>
          <Notice error={error} />
          <button className="button outline small" disabled={busy}>
            {busy ? "Saving…" : "Record return update"}
          </button>
        </form>
      )}
    </article>
  );
}
