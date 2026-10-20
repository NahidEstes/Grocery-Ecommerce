import mongoose from "mongoose";
import { products, type Product } from "../src/lib/catalog";
import { ProductModel, OrderModel } from "./models";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export function databaseMode() {
  return mongoose.connection.readyState === 1 ? "mongodb" : "demo";
}
export async function getCatalog(): Promise<Product[]> {
  if (databaseMode() === "demo") return products;
  return (await ProductModel.find(
    {},
    { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 },
  ).lean()) as unknown as Product[];
}
export async function saveOrder(order: Record<string, unknown>) {
  if (databaseMode() === "mongodb") {
    await OrderModel.create(order);
    return;
  }
  const directory = join(process.cwd(), ".data", "orders");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `${order.reference}.json`),
    JSON.stringify(order, null, 2),
    { flag: "wx", mode: 0o600 },
  );
}
