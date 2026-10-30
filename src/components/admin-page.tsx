"use client";
import { useStoreFormat } from "./store-format";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "./admin-shell";
import { AdminOverview } from "./admin-overview";
import { AdminOrders } from "./admin-orders";
import { AdminProductEditor } from "./admin-product-editor";
import { AdminProducts } from "./admin-products";
import {
  adminTools,
  allowedAdminTools,
  resolveAdminSection,
  type AdminOverviewData,
  type AdminSection,
  type OrderFilters,
} from "@/lib/admin-workspace";
import {
  Check,
  ChevronRight,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { api } from "@/lib/client-api";
import type { Product } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/storefront";

import { can, isStaff } from "@/lib/management";
import { ManagementPanel } from "./admin-management";
import { CaseTools } from "./admin-operations";
import { UnsavedProvider, useUnsaved } from "./admin-shared";

import { ProfileFields } from "./admin-profile";
type Overview = AdminOverviewData;
export function AdminPage({ initialSection }: { initialSection?: string }) {
  const { user } = useAccount();
  return (
    <UnsavedProvider key={`${user?.id}-${user?.role}`}>
      <AdminWorkspace initialSection={initialSection} />
    </UnsavedProvider>
  );
}
function AdminWorkspace({ initialSection }: { initialSection?: string }) {
  const { money, orderTime } = useStoreFormat();
  const { user, ready } = useAccount();
  const { confirmLeave, clean } = useUnsaved();
  const params = useSearchParams();
  const requested = params.get("section") || undefined;
  const tab = resolveAdminSection(requested, user?.role) || "orders";
  const [orderFilters, setOrderFilters] = useState<Partial<OrderFilters>>({});
  const [orderViewRevision, setOrderViewRevision] = useState(0);
  const [data, setData] = useState<Overview | null>(null),
    [notice, setNotice] = useState(""),
    [panelRevision, setPanelRevision] = useState(0),
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
    if (isStaff(user?.role)) void load();
  }, [user?.id, user?.role]);
  async function updateStatus(
    reference: string,
    status: import("@/lib/orders").OrderStatus,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/orders/${reference}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      setNotice(
        "Order status updated. The change was recorded in its history.",
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      return false;
    }
  }
  async function navigate(
    section: AdminSection,
    filters: Partial<OrderFilters> = {},
    product?: Product,
  ) {
    if (
      !allowedAdminTools(user?.role).some((tool) => tool.id === section) ||
      !(await confirmLeave())
    )
      return;
    setOrderFilters(filters);
    setOrderViewRevision((previous) => previous + 1);
    setNotice("");
    setError("");
    setQuery("");
    setStatus("");
    setEditing(product);
    window.history.pushState(null, "", `/admin?section=${section}`);
  }
  async function refreshWorkspace() {
    if (await confirmLeave()) {
      setPanelRevision((previous) => previous + 1);
      await load();
    }
  }
  if (!ready)
    return (
      <div className="page-container loading-state">Checking your account…</div>
    );
  if (!isStaff(user?.role))
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
    <AdminShell
      active={tab}
      role={user?.role}
      name={user!.name}
      storeName={data?.settings.profile.name || "FreshCart"}
      busy={busy}
      onRefresh={() => void refreshWorkspace()}
      onNavigate={(section) => void navigate(section)}
      taskCount={(data?.metrics.pending || 0) + (data?.metrics.lowStock || 0)}
    >
      {tab !== "overview" && tab !== "orders" && tab !== "products" && (
        <div className="workspace-page-heading">
          <div>
            <span className="eyebrow">YOUR STORE, WELL ORGANIZED</span>
            <h1>{adminTools.find((tool) => tool.id === tab)?.label}</h1>
            <p>Your tools and changes, in one focused workspace.</p>
          </div>
        </div>
      )}
      {error && (
        <p className="form-error admin-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-message admin-feedback" role="status">
          {notice}
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
          {[
            "recipes",
            "homepage",
            "catalog-tools",
            "inventory",
            "purchasing",
            "languages",
            "reports",
            "search",
            "returns",
            "team",
            "activity",
          ].includes(tab) && (
            <ManagementPanel
              key={`${tab}-${panelRevision}`}
              tab={tab}
              products={data.products}
              reload={load}
            />
          )}
          <div
            className={`storage-banner ${data.storage === "demo" ? "demo" : ""}`}
          >
            <ShieldCheck size={16} />
            {data.storage === "demo"
              ? "Local demo data · Orders do not schedule real delivery."
              : "MongoDB connected"}
            <span>Configured online payments require server verification.</span>
          </div>
          {tab === "overview" && (
            <AdminOverview
              data={data}
              role={user?.role}
              name={user!.name}
              navigate={(section, filters, product) =>
                void navigate(section, filters, product)
              }
              revision={panelRevision}
            />
          )}
          {tab === "products" &&
            (editing !== undefined ? (
              <AdminProductEditor
                product={editing}
                catalog={data.products}
                settings={data.settings}
                onCancel={() => setEditing(undefined)}
                onSave={async (p) => {
                  await api(`/admin/products/${p.id}`, {
                    method: "PUT",
                    body: JSON.stringify(p),
                  });
                  setEditing(undefined);
                  await load();
                  clean();
                  setNotice("Product saved successfully.");
                }}
              />
            ) : (
              <AdminProducts
                products={data.products}
                settings={data.settings}
                threshold={data.stockThreshold}
                edit={setEditing}
                bulk={() => void navigate("catalog-tools")}
              />
            ))}
          {tab === "orders" && (
            <AdminOrders
              key={orderViewRevision}
              orders={data.orders}
              settings={data.settings}
              role={user!.role}
              initialFilters={orderFilters}
              busy={busy}
              error={error}
              updateStatus={updateStatus}
              refresh={() => void load()}
            />
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
                clean();
                setNotice("Storefront settings saved.");
              }}
            />
          )}
          {tab === "support" && (
            <div className="admin-order-list">
              <div className="surface-card management-toolbar">
                <input
                  aria-label="Search support requests"
                  placeholder="Order, name or message…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Support status filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              {!data.support.length && (
                <div className="surface-card quiet-empty">
                  No support requests yet.
                </div>
              )}
              {data.support
                .filter(
                  (ticket) =>
                    (!status || ticket.status === status) &&
                    `${ticket.reference} ${ticket.name} ${ticket.message}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((ticket) => (
                  <article className="surface-card" key={ticket.id}>
                    <div className="card-title">
                      <strong>
                        {ticket.reference} · {ticket.name}
                      </strong>
                      <span className="filter-chip">{ticket.status}</span>
                    </div>
                    <p>{ticket.message}</p>
                    <small>{orderTime(ticket.createdAt)}</small>
                    <CaseTools
                      kind="support"
                      id={ticket.id}
                      createdAt={ticket.createdAt}
                      status={ticket.status}
                    />
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
              <div className="surface-card management-toolbar">
                <input
                  aria-label="Search customer reviews"
                  placeholder="Product, author or review…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Review status filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {["pending", "approved", "rejected"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              {!data.reviews.length && (
                <div className="surface-card quiet-empty">
                  No customer reviews to moderate yet.
                </div>
              )}
              {data.reviews
                .filter(
                  (r) =>
                    (!status || r.status === status) &&
                    `${r.productId} ${r.author} ${r.text}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((r) => (
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
                    <CaseTools
                      kind="review"
                      id={r.id}
                      createdAt={r.createdAt}
                      status={r.status}
                    />
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
    </AdminShell>
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
  const { markDirty, clean } = useUnsaved();
  useEffect(() => () => clean(), []);
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
    <form
      className="enhance-form settings-form"
      onSubmit={submit}
      onChange={markDirty}
    >
      <ProfileFields settings={draft} onChange={setDraft} />
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
        <button
          type="button"
          className="button outline small"
          onClick={() =>
            patch({
              zones: [
                ...draft.zones,
                {
                  name: `New area ${draft.zones.length + 1}`,
                  enabled: true,
                  fee: 40,
                  estimate: "Choose an available delivery slot",
                },
              ],
            })
          }
        >
          Add delivery area
        </button>
        <label>
          Free delivery from ({draft.profile.currency})
          <input
            type="number"
            min={1}
            required
            value={draft.freeDeliveryAt}
            onChange={(e) => patch({ freeDeliveryAt: Number(e.target.value) })}
          />
        </label>
        {draft.zones.map((z, i) => (
          <div className="settings-row" key={i}>
            <label>
              Area name
              <input
                required
                maxLength={80}
                value={z.name}
                onChange={(e) =>
                  patch({
                    zones: draft.zones.map((v, n) =>
                      n === i ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
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
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${z.name}`}
              disabled={draft.zones.length <= 1}
              onClick={() =>
                patch({ zones: draft.zones.filter((_, n) => n !== i) })
              }
            >
              <Trash2 size={17} />
            </button>
            <label>
              Delivery fee ({draft.profile.currency})
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
        <h3>Available time slots ({draft.profile.timeZone})</h3>
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
              Maximum discount ({draft.profile.currency})
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
