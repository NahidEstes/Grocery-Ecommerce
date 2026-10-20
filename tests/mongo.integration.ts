import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { ProductModel } from "../server/models";
import { products } from "../src/lib/catalog";
import { initializeRepository, atomic } from "../server/repository";
import { register, userByEmail, saveUser } from "../server/auth";
import { placeOrder, changeStatus } from "../server/checkout";
import {
  getCatalog,
  saveCatalog,
  findOrder,
  listOrders,
} from "../server/store";
import { deliveryDays } from "../src/lib/orders";
test(
  "MongoDB replica set: account persistence, stock transactions and idempotency",
  { skip: !process.env.MONGODB_TEST_URI },
  async (t) => {
    const dbName = `freshcart_test_${randomUUID().replaceAll("-", "")}`;
    await mongoose.connect(process.env.MONGODB_TEST_URI!, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
    t.after(async () => {
      if (
        mongoose.connection.name === dbName &&
        dbName.startsWith("freshcart_test_")
      )
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    assert.ok(
      hello.setName || hello.msg === "isdbgrid",
      "A replica set is required.",
    );
    await initializeRepository();
    await ProductModel.init();
    await ProductModel.insertMany(products);
    const user = await register(
      "Mongo Tester",
      "mongo@example.test",
      "mongo-password-123",
    );
    assert.equal((await userByEmail(user.email))!.role, "customer");
    await atomic(async () => {
      await saveUser({ ...user, name: "Saved account" });
    });
    assert.equal((await userByEmail(user.email))!.name, "Saved account");
    await atomic(async () => {
      const catalog = await getCatalog();
      await saveCatalog(
        catalog.map((p) => (p.id === "banana" ? { ...p, stock: 1 } : p)),
      );
    });
    const input = () => ({
      customer: {
        name: "Mongo Tester",
        phone: "01712345678",
        address: "Test apartment, Road 7, Dhaka",
        area: "Dhanmondi" as const,
      },
      items: [{ productId: "banana", quantity: 1 }],
      deliverySelection: {
        date: deliveryDays()[1].date,
        slot: "afternoon" as const,
      },
      instructions: "",
      payment: "cash-on-delivery" as const,
      acceptedTerms: true as const,
      requestId: randomUUID(),
      accessToken: randomUUID(),
    });
    const payload = input();
    const duplicates = await Promise.all([
      placeOrder(payload, user),
      placeOrder(payload, user),
    ]);
    assert.equal(duplicates[0].order.reference, duplicates[1].order.reference);
    assert.equal((await listOrders()).length, 1);
    assert.equal((await getCatalog()).find((p) => p.id === "banana")!.stock, 0);
    await assert.rejects(() => placeOrder(input(), user), /unavailable/);
    const reference = duplicates[0].order.reference;
    await changeStatus(reference, "cancelled");
    assert.equal((await getCatalog()).find((p) => p.id === "banana")!.stock, 1);
    assert.equal((await findOrder(reference))!.status, "cancelled");
  },
);
