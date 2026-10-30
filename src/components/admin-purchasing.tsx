"use client";
import { useStoreFormat } from "./store-format";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

import { isExpired, type Supplier, type InventoryBatch } from "@/lib/inventory";
import { Notice, useUnsaved } from "./admin-shared";
type PurchasingData = {
  today: string;
  suppliers: Supplier[];
  batches: InventoryBatch[];
  products: {
    id: string;
    name: string;
    unit: string;
    stock: number;
    tracked: number;
    untracked: number;
    expired: number;
    sellable: number;
  }[];
};
export function PurchasingPanel({ reload }: { reload: () => Promise<void> }) {
  const { money } = useStoreFormat();
  const [data, setData] = useState<PurchasingData>(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [supplier, setSupplier] = useState<Supplier | null | undefined>(),
    [withdraw, setWithdraw] = useState<InventoryBatch>(),
    [receiptId, setReceiptId] = useState(() => crypto.randomUUID()),
    [supplierId, setSupplierId] = useState(() => crypto.randomUUID());
  const { markDirty, clean, confirmLeave } = useUnsaved();
  async function load() {
    setData(await api("/admin/purchasing"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    return () => clean();
  }, []);
  async function act(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await Promise.all([load(), reload()]);
      clean();
      setSuccess(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="surface-card">
        <h2>Suppliers & batches</h2>
        <Notice error={error} />
        <button
          className="button outline"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
      </section>
    );
  const soon = (batch: InventoryBatch) =>
    !!batch.expiresOn &&
    !isExpired(batch, data.today) &&
    batch.expiresOn <=
      new Date(Date.parse(`${data.today}T12:00:00Z`) + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
  return (
    <div className="management-stack purchasing-panel">
      <section className="surface-card">
        <div className="card-title">
          <div>
            <span className="eyebrow">SUPPLY & FRESHNESS</span>
            <h2>Suppliers & batches</h2>
            <p>
              Receipts add packs to inventory. Expiry follows the store time
              zone; dated batches are reserved in earliest-expiry order.
            </p>
          </div>
          <button
            className="button outline small"
            disabled={busy}
            onClick={async () => {
              if (await confirmLeave()) {
                clean();
                await act(load, "Inventory refreshed.");
              }
            }}
          >
            Refresh
          </button>
        </div>
        <div className="purchasing-metrics">
          <div>
            <strong>{data.suppliers.filter((s) => s.active).length}</strong>
            <span>Active suppliers</span>
          </div>
          <div>
            <strong>
              {data.batches
                .filter((b) => b.remaining && isExpired(b, data.today))
                .reduce((n, b) => n + b.remaining, 0)}
            </strong>
            <span>Expired packs · blocked</span>
          </div>
          <div>
            <strong>
              {data.batches
                .filter((b) => b.remaining && soon(b))
                .reduce((n, b) => n + b.remaining, 0)}
            </strong>
            <span>Packs expiring within 7 days</span>
          </div>
        </div>
      </section>
      <Notice error={error} success={success} />
      <section className="surface-card">
        <div className="card-title">
          <h2>Suppliers</h2>
          <button
            className="button outline small"
            disabled={busy}
            onClick={async () => {
              if (await confirmLeave()) {
                clean();
                setSupplierId(crypto.randomUUID());
                setWithdraw(undefined);
                setReceiptId(crypto.randomUUID());
                setSupplier(null);
              }
            }}
          >
            Add supplier
          </button>
        </div>
        <div className="supplier-list">
          {data.suppliers.map((s) => (
            <button
              key={s.id}
              className="button outline small"
              disabled={busy}
              onClick={async () => {
                if (await confirmLeave()) {
                  clean();
                  setWithdraw(undefined);
                  setReceiptId(crypto.randomUUID());
                  setSupplier(s);
                }
              }}
            >
              {s.name}
              {!s.active ? " · Inactive" : ""}
            </button>
          ))}
          {!data.suppliers.length && (
            <p>
              No suppliers yet. Add your first supplier before receiving goods.
            </p>
          )}
        </div>
        {supplier !== undefined && (
          <form
            key={supplier?.id || "new"}
            className="enhance-form supplier-editor"
            onChange={markDirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const text = (k: string) => String(form.get(k) || "").trim();
              const input = {
                name: text("name"),
                contact: text("contact"),
                phone: text("phone"),
                email: text("email"),
                address: text("address"),
                notes: text("notes"),
                active: form.has("active"),
                version: supplier?.version || 0,
              };
              if (
                await act(
                  () =>
                    api(`/admin/suppliers/${supplier?.id || supplierId}`, {
                      method: "PUT",
                      body: JSON.stringify(input),
                    }),
                  "Supplier saved.",
                )
              )
                setSupplier(undefined);
            }}
          >
            <h3>{supplier ? "Edit supplier" : "New supplier"}</h3>
            <div className="form-row">
              <label>
                Supplier name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={supplier?.name}
                />
              </label>
              <label>
                Contact person
                <input
                  name="contact"
                  maxLength={100}
                  defaultValue={supplier?.contact}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Phone
                <input
                  name="phone"
                  maxLength={40}
                  defaultValue={supplier?.phone}
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  maxLength={200}
                  defaultValue={supplier?.email}
                />
              </label>
            </div>
            <label>
              Address
              <input
                name="address"
                maxLength={300}
                defaultValue={supplier?.address}
              />
            </label>
            <label>
              Notes
              <textarea
                name="notes"
                maxLength={1000}
                defaultValue={supplier?.notes}
              />
            </label>
            <label className="check-label">
              <input
                name="active"
                type="checkbox"
                defaultChecked={supplier?.active ?? true}
              />
              Active supplier
            </label>
            <div className="inline-actions">
              <button className="button primary" disabled={busy}>
                Save supplier
              </button>
              <button
                type="button"
                className="button outline"
                onClick={async () => {
                  if (await confirmLeave()) {
                    clean();
                    setSupplier(undefined);
                  }
                }}
              >
                Close
              </button>
            </div>
          </form>
        )}
      </section>
      {supplier === undefined && !withdraw && (
        <section className="surface-card">
          <h2>Receive a batch</h2>
          <p>
            Quantity is full product packs. Unit cost is the purchase cost of
            one pack, kept private to administrators and managers.
          </p>
          <form
            key={receiptId}
            className="enhance-form"
            onChange={markDirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const input = {
                receiptId,
                supplierId: form.get("supplier"),
                productId: form.get("product"),
                batchNumber: String(form.get("number") || "").trim(),
                receivedOn: form.get("received"),
                expiresOn: form.get("expiry") || null,
                quantity: Number(form.get("quantity")),
                unitCost: Number(form.get("cost")),
              };
              if (
                await act(
                  () =>
                    api("/admin/batches", {
                      method: "POST",
                      body: JSON.stringify(input),
                    }),
                  "Batch received and stock updated.",
                )
              )
                setReceiptId(crypto.randomUUID());
            }}
          >
            <div className="form-row">
              <label>
                Supplier
                <select name="supplier" required defaultValue="">
                  <option value="" disabled>
                    Choose supplier
                  </option>
                  {data.suppliers
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Product / SKU
                <select name="product" required defaultValue="">
                  <option value="" disabled>
                    Choose SKU
                  </option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.unit} · {p.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Batch number
                <input name="number" required maxLength={80} />
              </label>
              <label>
                Packs received
                <input
                  name="quantity"
                  type="number"
                  required
                  min={1}
                  max={100000}
                  step={1}
                />
              </label>
              <label>
                Purchase cost per pack (store currency)
                <input
                  name="cost"
                  type="number"
                  required
                  min={0}
                  max={500000}
                  step="0.01"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Received date
                <input
                  name="received"
                  type="date"
                  required
                  max={data.today}
                  defaultValue={data.today}
                />
              </label>
              <label>
                Expiry date (optional)
                <input name="expiry" type="date" min={data.today} />
              </label>
            </div>
            <p className="muted">
              Leave expiry empty only for goods without a labelled expiry.
              Existing stock remains untracked until received through this
              workflow. Never receive existing packs again merely to assign a
              batch.
            </p>
            <button
              className="button primary"
              disabled={busy || !data.suppliers.some((s) => s.active)}
            >
              Receive batch
            </button>
          </form>
        </section>
      )}
      <section className="surface-card">
        <h2>Batch register</h2>
        <div className="bilingual-picker">
          <label>
            Find a batch
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Batch, supplier or product…"
            />
          </label>
          <label>
            Expiry status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All batches</option>
              <option value="expired">Expired</option>
              <option value="soon">Expiring within 7 days</option>
              <option value="available">Available</option>
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product / batch</th>
                <th>Supplier</th>
                <th>Received / expiry</th>
                <th>Packs left</th>
                <th>Unit cost</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.batches
                .filter(
                  (b) =>
                    `${b.batchNumber} ${data.suppliers.find((s) => s.id === b.supplierId)?.name} ${data.products.find((p) => p.id === b.productId)?.name}`
                      .toLowerCase()
                      .includes(query.toLowerCase()) &&
                    (status === "all" ||
                      (status === "expired" && isExpired(b, data.today)) ||
                      (status === "soon" && soon(b)) ||
                      (status === "available" &&
                        b.remaining > 0 &&
                        !isExpired(b, data.today))),
                )
                .sort((a, b) =>
                  (a.expiresOn || "9999").localeCompare(b.expiresOn || "9999"),
                )
                .map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>
                        {data.products.find((p) => p.id === b.productId)
                          ?.name || b.productId}
                      </strong>
                      <small>
                        {b.batchNumber} · {b.productId}
                      </small>
                    </td>
                    <td>
                      {data.suppliers.find((s) => s.id === b.supplierId)
                        ?.name || "Unknown"}
                    </td>
                    <td>
                      {b.receivedOn}
                      <small>{b.expiresOn || "No labelled expiry"}</small>
                    </td>
                    <td>
                      {b.remaining} / {b.received}
                    </td>
                    <td>{money(b.unitCost)}</td>
                    <td>
                      <span
                        className={isExpired(b, data.today) ? "low-stock" : ""}
                      >
                        {!b.remaining
                          ? "Depleted"
                          : isExpired(b, data.today)
                            ? "Expired · blocked"
                            : soon(b)
                              ? "Expiring soon"
                              : "Available"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        disabled={busy || !b.remaining}
                        onClick={async () => {
                          if (await confirmLeave()) {
                            clean();
                            setSupplier(undefined);
                            setReceiptId(crypto.randomUUID());
                            setWithdraw(b);
                          }
                        }}
                      >
                        Withdraw
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!data.batches.length && (
          <p className="quiet-empty">Received batches will appear here.</p>
        )}
        {withdraw && (
          <form
            key={withdraw.id}
            className="enhance-form batch-withdraw"
            onChange={markDirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await act(
                  () =>
                    api(`/admin/batches/${withdraw.id}/withdraw`, {
                      method: "POST",
                      body: JSON.stringify({
                        quantity: Number(form.get("quantity")),
                        reason: form.get("reason"),
                        version: withdraw.version,
                      }),
                    }),
                  "Packs withdrawn. Stock and audit history updated.",
                )
              )
                setWithdraw(undefined);
            }}
          >
            <h3>Withdraw from {withdraw.batchNumber}</h3>
            <p>
              Use this for expired, damaged or discarded packs. The stock
              reduction is recorded with your reason.
            </p>
            <label>
              Packs to withdraw
              <input
                name="quantity"
                type="number"
                required
                min={1}
                max={withdraw.remaining}
                step={1}
              />
            </label>
            <label>
              Reason
              <input name="reason" required minLength={3} maxLength={300} />
            </label>
            <div className="inline-actions">
              <button className="button primary" disabled={busy}>
                Withdraw packs
              </button>
              <button
                type="button"
                className="button outline"
                onClick={async () => {
                  if (await confirmLeave()) {
                    clean();
                    setWithdraw(undefined);
                  }
                }}
              >
                Close
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="surface-card">
        <h2>Inventory reconciliation</h2>
        <p>
          Existing inventory and inspected returns without a new batch receipt
          remain untracked. Add batch receipts only for newly received goods.
          Expired tracked packs are excluded from the storefront and checkout.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Total on hand</th>
                <th>Tracked</th>
                <th>Untracked</th>
                <th>Expired</th>
                <th>Sellable today</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <small>
                      {p.id} · {p.unit}
                    </small>
                  </td>
                  <td>{p.stock}</td>
                  <td>{p.tracked}</td>
                  <td>{p.untracked}</td>
                  <td>{p.expired}</td>
                  <td>{p.sellable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
