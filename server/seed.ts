import "dotenv/config";
import mongoose from "mongoose";
import { ProductModel } from "./models";
import { products } from "../src/lib/catalog";
if (!process.env.MONGODB_URI)
  throw new Error("Set MONGODB_URI in .env before seeding.");
try {
  await mongoose.connect(process.env.MONGODB_URI);
  await ProductModel.bulkWrite(
    products.map((p) => ({
      updateOne: {
        filter: { id: p.id },
        update: { $setOnInsert: p },
        upsert: true,
      },
    })),
  );
  console.log("Catalog seeded. Existing products were preserved.");
} finally {
  await mongoose.disconnect();
}
