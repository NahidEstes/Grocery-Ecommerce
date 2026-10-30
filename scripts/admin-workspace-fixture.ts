// Used only by verify-admin-workspace.mjs. All accounts/data are disposable and
// live in a newly generated temporary directory, never the user's .data.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { Account } from "../src/lib/storefront";
import type { OrderRecord } from "../src/lib/orders";
export async function startAdminFixture(origin: string) {
  const directory = await mkdtemp(join(tmpdir(), "freshcart-admin-workspace-"));
  process.env.FRESHCART_DATA_DIR = directory;
  process.env.STORE_MODE = "demo";
  process.env.WEB_ORIGIN = origin;
  Object.assign(process.env, { NODE_ENV: "test" });
  delete process.env.MONGODB_URI;
  delete process.env.SSLCOMMERZ_STORE_ID;
  const [
    { app },
    { register, saveUser, digest },
    { writeEntity },
    { getCatalog, saveCatalog, saveOrder },
    { deliveryDays },
  ] = await Promise.all([
    import("../server/app"),
    import("../server/auth"),
    import("../server/repository"),
    import("../server/store"),
    import("../src/lib/orders"),
  ]);
  const password = "Disposable-qa-password-2026";
  for (const role of [
    "admin",
    "manager",
    "editor",
    "fulfilment",
    "customer",
  ] as Account["role"][]) {
    const user = await register(
      `${role[0].toUpperCase()}${role.slice(1)} Preview`,
      `${role}@workspace.example.test`,
      password,
    );
    if (role !== "customer") await saveUser({ ...user, role });
  }
  const catalog = await getCatalog();
  catalog[0].stock = 2;
  catalog[1].stock = 4;
  await saveCatalog(catalog);
  const batchId = randomUUID();
  await writeEntity(`batch:${batchId}`, {
    id: batchId,
    productId: catalog[0].id,
    supplierId: randomUUID(),
    batchNumber: "QA-BATCH",
    receivedOn: "2026-10-01",
    expiresOn: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10),
    unitCost: 20,
    received: 1,
    remaining: 1,
    version: 0,
    createdAt: new Date().toISOString(),
  });
  const day = deliveryDays()[0];
  const next = deliveryDays()[1];
  const snapshots: OrderRecord[] = [];
  for (let index = 0; index < 16; index++) {
    const status = (
      [
        "placed",
        "preparing",
        "out-for-delivery",
        "delivered",
        "cancelled",
      ] as const
    )[index % 5];
    const order: OrderRecord = {
      reference: `FC-AB${String(1001 + index).padStart(6, "0")}`,
      customer: {
        name: ["Alex Example", "Sam Sample", "Taylor Demo"][index % 3],
        phone: "01700000000",
        address: "House 123, Example Road, Demo Apartment",
        area: index % 2 ? "Mirpur" : "Dhanmondi",
      },
      items: [
        {
          productId: "apple",
          name: "Apple (Fuji)",
          unit: "1 kg",
          atlas: 1,
          quantity: 1,
          price: 225,
        },
      ],
      subtotal: 225,
      discount: 0,
      delivery: 40,
      total: 265,
      deliverySelection: {
        date: index % 2 ? day.date : next.date,
        slot: "evening",
      },
      instructions: "Fictional QA order. No real delivery.",
      payment: index % 2 ? "online" : "cash-on-delivery",
      paymentStatus: index % 2 ? "paid" : "unpaid",
      status,
      mode: "demo",
      currency: "BDT",
      timeZone: "Asia/Dhaka",
      createdAt: new Date(Date.now() - index * 60_000).toISOString(),
      inventoryReserved: false,
      accessTokenHash: digest(randomUUID()),
      fingerprint: "admin-workspace-qa",
    };
    if (index === 15) Reflect.deleteProperty(order, "deliverySelection");
    await saveOrder(order);
    snapshots.push(structuredClone(order));
  }
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture port unavailable");
  return {
    base: `http://127.0.0.1:${address.port}`,
    password,
    directory,
    async resetOrders() {
      for (const order of snapshots)
        await writeEntity(`order:${order.reference}`, order);
    },
    async close() {
      await new Promise<void>((done) => server.close(() => done()));
      const target = resolve(directory),
        permitted = `${resolve(tmpdir())}${sep}freshcart-admin-workspace-`;
      if (!target.startsWith(permitted))
        throw new Error("Unexpected fixture cleanup target");
      await rm(target, { recursive: true, force: true });
    },
  };
}
