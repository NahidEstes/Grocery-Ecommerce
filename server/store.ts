import { zonedDate } from "../src/lib/store-profile";
import { products, type Product } from "../src/lib/catalog";
import { defaultSettings, type StoreSettings } from "../src/lib/storefront";
import type { Review } from "../src/lib/storefront";
import { ProductModel, OrderModel } from "./models";
import type { Customer, OrderRecord } from "../src/lib/orders";
import {
  atomic,
  readEntity,
  writeEntity,
  listEntities,
  mongo,
  dataDirectory,
} from "./repository";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getContent } from "./management-store";
import { assertBatchStock, getBatches } from "./inventory-store";
import { stockSummary } from "../src/lib/inventory";
import { profileFor } from "../src/lib/store-profile";
export function databaseMode() {
  return mongo() ? ("mongodb" as const) : ("demo" as const);
}
export async function getCatalog(): Promise<Product[]> {
  const saved = await readEntity<Product[]>("catalog");
  if (saved) return saved;
  if (mongo()) {
    const catalog = await ProductModel.find(
      {},
      { _id: 0, __v: 0, updatedAt: 0 },
    ).lean();
    return catalog.map((p) => ({
      ...p,
      createdAt: p.createdAt?.toISOString(),
      rating: 0,
    })) as unknown as Product[];
  }
  return structuredClone(products);
}
export async function saveCatalog(catalog: Product[]) {
  await assertBatchStock(catalog);
  await writeEntity("catalog", catalog);
}
export async function getPublicCatalog() {
  return atomic(async () => {
    const catalog = await getCatalog();
    const batches = await getBatches();
    const today = zonedDate(new Date(), (await getSettings()).profile.timeZone);
    const content = await getContent();
    const reviews = (await listEntities<Review>("review:")).filter(
      (r) => r.status === "approved",
    );
    return catalog
      .filter((p) => p.active !== false)
      .map((p) => {
        const id = p.parentId || p.id;
        const group = reviews.filter((r) => {
          const sku = catalog.find((v) => v.id === r.productId);
          return (sku?.parentId || sku?.id) === id;
        });
        return {
          ...p,
          stock: stockSummary(
            p.stock,
            batches.filter((b) => b.productId === p.id),
            today,
          ).sellable,
          searchTerms: [
            ...(p.searchTerms || []),
            ...content.aliases
              .filter(
                (a) =>
                  a.productIds.includes(p.id) ||
                  (!!p.parentId && a.productIds.includes(p.parentId)),
              )
              .map((a) => a.term),
          ],
          rating: group.length
            ? Number(
                (
                  group.reduce((n, r) => n + r.rating, 0) / group.length
                ).toFixed(1),
              )
            : 0,
        };
      });
  });
}
export async function getSettings(): Promise<StoreSettings> {
  const settings =
    (await readEntity<StoreSettings>("settings")) ||
    structuredClone(defaultSettings);
  return { ...settings, profile: profileFor(settings.profile) };
}
export async function saveSettings(settings: StoreSettings) {
  await atomic(async () => {
    await fenceSettings();
    await writeEntity("settings", settings);
  });
}
// Serialize merchant-setting edits against a checkout using those settings.
// This prevents a first-order/currency-edit write skew across API instances.
export async function fenceSettings() {
  const old = await readEntity<{ revision: number }>("settings-fence");
  await writeEntity("settings-fence", { revision: (old?.revision || 0) + 1 });
}
export async function findOrder(
  reference: string,
): Promise<OrderRecord | null> {
  if (!/^FC-[A-F0-9]{8,12}$/.test(reference)) return null;
  const saved = await readEntity<OrderRecord>(`order:${reference}`);
  if (saved) return saved;
  if (mongo()) {
    const found = await OrderModel.findOne(
      { reference },
      { _id: 0, __v: 0 },
    ).lean();
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }
  try {
    return JSON.parse(
      await readFile(
        join(dataDirectory(), "orders", `${reference}.json`),
        "utf8",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function listOrders(): Promise<OrderRecord[]> {
  const records = await listEntities<OrderRecord>("order:");
  let legacy: OrderRecord[] = [];
  if (mongo())
    legacy = JSON.parse(
      JSON.stringify(await OrderModel.find({}, { _id: 0, __v: 0 }).lean()),
    );
  else {
    try {
      const files = await readdir(join(dataDirectory(), "orders"));
      legacy = (
        await Promise.all(
          files
            .filter((f) => /^FC-[A-F0-9]{8,12}\.json$/.test(f))
            .map((f) => findOrder(f.slice(0, -5))),
        )
      ).filter((o): o is OrderRecord => !!o);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return [
    ...new Map([...legacy, ...records].map((o) => [o.reference, o])).values(),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveOrder(order: OrderRecord) {
  if (await findOrder(order.reference))
    throw Object.assign(new Error("Order exists"), { code: "EEXIST" });
  await writeEntity(`order:${order.reference}`, order);
}
export async function replaceOrder(order: OrderRecord) {
  await writeEntity(`order:${order.reference}`, order);
}
export async function updateOrderAddress(
  reference: string,
  customer: Customer,
) {
  return atomic(async () => {
    const order = await findOrder(reference);
    if (!order || order.status !== "placed") return null;
    const updated = { ...order, customer };
    await replaceOrder(updated);
    return updated;
  });
}
