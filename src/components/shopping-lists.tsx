"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowRight,
  Check,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Undo2,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { useShop } from "./shop-provider";
import { useShopping } from "./shopping-provider";
import { AddSelection } from "./basket-selection";
import { Breadcrumb, Modal, ProductImage, QuantityControl } from "./ui";
import { api } from "@/lib/client-api";
import { money, type CartItem } from "@/lib/commerce";
import {
  planBasket,
  type ShoppingList,
  type ShoppingListInput,
} from "@/lib/shopping";
import { searchScore } from "@/lib/search";

export function ShoppingListsPage() {
  const { user } = useAccount();
  return <ShoppingListsContent key={user?.id || "guest"} />;
}
function ShoppingListsContent() {
  const { user, ready: accountReady } = useAccount();
  const { catalog, items, ready } = useShop();
  const { lists, loading, error, refresh, recordList } = useShopping();
  const [editing, setEditing] = useState<ShoppingList | null | undefined>(
      undefined,
    ),
    [useCart, setUseCart] = useState(false),
    [archived, setArchived] = useState(false),
    [busy, setBusy] = useState(""),
    [actionError, setActionError] = useState("");
  useEffect(() => {
    if (
      user &&
      ready &&
      new URLSearchParams(window.location.search).get("from") === "cart"
    ) {
      setUseCart(true);
      setEditing(null);
      window.history.replaceState({}, "", "/lists");
    }
  }, [user?.id, ready]);
  async function save(input: ShoppingListInput) {
    const result = await api<{ list: ShoppingList }>(
      editing ? `/me/lists/${editing.id}` : "/me/lists",
      {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...input,
          ...(editing ? { version: editing.version } : {}),
        }),
      },
    );
    recordList(result.list);
    setEditing(undefined);
  }
  async function archive(list: ShoppingList) {
    setBusy(list.id);
    setActionError("");
    try {
      const result = await api<{ list: ShoppingList }>(
        `/me/lists/${list.id}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archived: !list.archived,
            version: list.version,
          }),
        },
      );
      recordList(result.list);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!accountReady)
    return (
      <div className="page-container loading-state">Opening your lists…</div>
    );
  return (
    <div className="page-container lists-page">
      <Breadcrumb items={[{ label: "Shopping lists" }]} />
      <div className="planning-heading">
        <div>
          <span className="eyebrow">
            <ListChecks size={15} /> YOUR EVERYDAY, REMEMBERED
          </span>
          <h1>
            Your shopping lists<span className="heading-dot">.</span>
          </h1>
          <p>Plan once. Shop a little easier, every time.</p>
        </div>
        {user && (
          <div className="planning-actions">
            <button
              className="button outline"
              disabled={!ready || !items.length}
              onClick={() => {
                setUseCart(true);
                setEditing(null);
              }}
            >
              <ShoppingBag size={16} /> Save current basket
            </button>
            <button
              className="button primary"
              onClick={() => {
                setUseCart(false);
                setEditing(null);
              }}
            >
              <Plus size={17} /> New list
            </button>
          </div>
        )}
      </div>
      {!user ? (
        <section className="planning-signin">
          <span className="round-icon">
            <ListChecks size={29} />
          </span>
          <h2>A home for your regular groceries.</h2>
          <p>
            Create a weekly list, a family top-up or a list for a favourite
            recipe. Your lists stay with your account on every device.
          </p>
          <Link className="button primary" href="/account">
            Sign in to make a list <ArrowRight size={17} />
          </Link>
          <Link href="/recipes" className="subtle-link">
            Explore recipes while you browse →
          </Link>
        </section>
      ) : (
        <>
          <div className="list-view-tabs">
            <button
              className={!archived ? "active" : ""}
              onClick={() => setArchived(false)}
            >
              My lists <span>{lists.filter((l) => !l.archived).length}</span>
            </button>
            <button
              className={archived ? "active" : ""}
              onClick={() => setArchived(true)}
            >
              Archived <span>{lists.filter((l) => l.archived).length}</span>
            </button>
            <button
              className="text-button"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {(error || actionError) && (
            <p className="form-error planning-error" role="alert">
              {actionError || error}
            </p>
          )}
          {loading && !lists.length ? (
            <div className="loading-state">Finding your shopping lists…</div>
          ) : (
            <div className="personal-list-grid">
              {lists
                .filter((l) => l.archived === archived)
                .map((list) => {
                  const plan = planBasket(list.items, catalog, items);
                  return (
                    <article className="personal-list-card" key={list.id}>
                      <div className="list-card-top">
                        <span className="round-icon">
                          <ListChecks size={23} />
                        </span>
                        <span>
                          {list.items.reduce((n, i) => n + i.quantity, 0)} packs
                          · {list.items.length} products
                        </span>
                      </div>
                      <h2>{list.name}</h2>
                      <p>
                        {list.notes ||
                          "A little planning for a fresher everyday."}
                      </p>
                      <div className="list-preview-items">
                        {list.items.slice(0, 4).map((i) => {
                          const p = catalog.find((p) => p.id === i.productId);
                          return (
                            <div key={i.productId}>
                              {p ? (
                                <ProductImage product={p} />
                              ) : (
                                <span className="unavailable-thumbnail">
                                  <ShoppingBag size={20} />
                                </span>
                              )}
                              <span>
                                <strong>{p?.name || i.name}</strong>
                                <small>{p?.unit || i.unit}</small>
                              </span>
                              <b>×{i.quantity}</b>
                            </div>
                          );
                        })}
                        {list.items.length > 4 && (
                          <small>+ {list.items.length - 4} more products</small>
                        )}
                        {!list.items.length && (
                          <div className="list-is-empty">
                            Ready for your first fresh find.
                          </div>
                        )}
                      </div>
                      {!list.archived && (
                        <>
                          <div className="list-current-total">
                            <span>
                              Available to add
                              <strong>{money(plan.subtotal)}</strong>
                            </span>
                            <small>Current prices · products only</small>
                          </div>
                          {plan.issues.length > 0 && (
                            <p className="list-stock-note">
                              {plan.issues.length}{" "}
                              {plan.issues.length === 1
                                ? "product has"
                                : "products have"}{" "}
                              limited availability. Only available additional
                              packs will be added.
                            </p>
                          )}
                          <AddSelection
                            items={list.items}
                            label="Add available items"
                          />
                        </>
                      )}
                      <div className="list-card-actions">
                        {!list.archived && (
                          <button
                            onClick={() => {
                              setUseCart(false);
                              setEditing(list);
                            }}
                          >
                            Edit list
                          </button>
                        )}
                        <button
                          disabled={busy === list.id}
                          onClick={() => void archive(list)}
                        >
                          {list.archived ? (
                            <Undo2 size={14} />
                          ) : (
                            <Archive size={14} />
                          )}{" "}
                          {busy === list.id
                            ? "Updating…"
                            : list.archived
                              ? "Restore list"
                              : "Archive"}
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
          {!loading &&
            !lists.some((l) => l.archived === archived) &&
            !error && (
              <div className="planning-signin compact">
                <ListChecks size={40} />
                <h2>
                  {archived
                    ? "No archived lists."
                    : "Your next market day starts here."}
                </h2>
                <p>
                  {archived
                    ? "Lists you archive can be restored here."
                    : "Save your weekly essentials and add them to your basket whenever you need them."}
                </p>
                {!archived && (
                  <button
                    className="button primary"
                    onClick={() => {
                      setUseCart(false);
                      setEditing(null);
                    }}
                  >
                    <Plus size={16} /> Create your first list
                  </button>
                )}
              </div>
            )}
          <div className="list-explainer">
            <Check size={17} />
            <p>
              List quantities stay as you saved them. Basket additions use
              current prices and stock; archiving a list keeps it available to
              restore.
            </p>
          </div>
        </>
      )}
      {user && editing !== undefined && (
        <ListEditor
          key={editing?.id || `new-${useCart}`}
          initial={editing || undefined}
          initialItems={useCart ? items : []}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

function ListEditor({
  initial,
  initialItems,
  onSave,
  onClose,
}: {
  initial?: ShoppingList;
  initialItems: CartItem[];
  onSave: (input: ShoppingListInput) => Promise<void>;
  onClose: () => void;
}) {
  const { catalog } = useShop();
  const [draft, setDraft] = useState<CartItem[]>(
      () =>
        initial?.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })) || initialItems.map((i) => ({ ...i })),
    ),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const matches = catalog
    .filter(
      (p) =>
        p.active !== false && (!query.trim() || searchScore(p, query) >= 0),
    )
    .sort((a, b) =>
      query
        ? searchScore(b, query) - searchScore(a, query)
        : Number(!!a.parentId) - Number(!!b.parentId),
    )
    .slice(0, 5);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave({
        name: String(form.get("name")).trim(),
        notes: String(form.get("notes") || ""),
        items: draft,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Edit your shopping list" : "Make a little list"}
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="enhance-form list-editor" onSubmit={submit}>
        <div className="form-grid">
          <label>
            List name
            <input
              name="name"
              defaultValue={initial?.name || ""}
              minLength={2}
              maxLength={60}
              required
              placeholder="e.g. সাপ্তাহিক বাজার"
            />
          </label>
          <label>
            A little note (optional)
            <input
              name="notes"
              defaultValue={initial?.notes}
              maxLength={200}
              placeholder="Breakfast, lunch and a few treats…"
            />
          </label>
        </div>
        <div className="list-editor-selected">
          <div className="card-title">
            <h3>Your products</h3>
            <span>{draft.length}/50</span>
          </div>
          {!draft.length && (
            <p className="muted">
              Add a few favourites below. An empty list can be saved for later.
            </p>
          )}
          {draft.map((i) => {
            const p = catalog.find((p) => p.id === i.productId),
              old = initial?.items.find((v) => v.productId === i.productId);
            const name = p?.name || old?.name || "Unavailable product";
            return (
              <div className="list-draft-row" key={i.productId}>
                <div>
                  {p && <ProductImage product={p} />}
                  <span>
                    <strong>{name}</strong>
                    <small>
                      {p?.unit || old?.unit}
                      {!p ? " · Currently unavailable" : ""}
                    </small>
                  </span>
                </div>
                <QuantityControl
                  compact
                  quantity={i.quantity}
                  max={100}
                  label={`${name} ${p?.unit || old?.unit || ""} on list`}
                  onChange={(quantity) =>
                    setDraft((previous) =>
                      quantity
                        ? previous.map((v) =>
                            v.productId === i.productId
                              ? { ...v, quantity }
                              : v,
                          )
                        : previous.filter((v) => v.productId !== i.productId),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${name} ${p?.unit || ""} from list`}
                  onClick={() =>
                    setDraft((previous) =>
                      previous.filter((v) => v.productId !== i.productId),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
        <label>
          Find products for this list
          <div className="list-product-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 100))}
              placeholder="আলু, milk, bread…"
              aria-label="Find products for this list"
            />
          </div>
        </label>
        <div className="list-picker-results">
          {matches.map((p) => (
            <div key={p.id}>
              <ProductImage product={p} />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.unit} · {money(p.price)}
                  {p.stock < 1 ? " · Out of stock" : ""}
                </small>
              </span>
              <button
                type="button"
                disabled={
                  (draft.length >= 50 &&
                    !draft.some((i) => i.productId === p.id)) ||
                  (draft.find((i) => i.productId === p.id)?.quantity || 0) >=
                    100
                }
                aria-label={`Add ${p.name} ${p.unit} to list`}
                onClick={() =>
                  setDraft((previous) =>
                    previous.some((i) => i.productId === p.id)
                      ? previous.map((i) =>
                          i.productId === p.id
                            ? { ...i, quantity: Math.min(100, i.quantity + 1) }
                            : i,
                        )
                      : [...previous, { productId: p.id, quantity: 1 }],
                  )
                }
              >
                <Plus size={17} />
              </button>
            </div>
          ))}
          {!matches.length && (
            <p className="quiet-empty">No groceries found. Try another name.</p>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="list-editor-footer">
          <p>Saving a list does not change your basket or reserve stock.</p>
          <button className="button primary" disabled={busy}>
            <Check size={17} />
            {busy ? "Saving…" : "Save list"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
