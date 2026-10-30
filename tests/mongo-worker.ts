// Optional real-integration worker: a separate API process/connection, no mocks.
import mongoose from "mongoose";
import { initializeRepository } from "../server/repository";
import { placeOrder } from "../server/checkout";
try {
  await mongoose.connect(process.env.MONGODB_TEST_URI!, {
    dbName: process.env.MONGO_WORKER_DB,
  });
  await initializeRepository();
  const result = await placeOrder(JSON.parse(process.argv[2]), null);
  console.log(
    JSON.stringify({
      created: result.created,
      reference: result.order.reference,
    }),
  );
} catch (e) {
  console.log(
    JSON.stringify({
      error: (e as Error).message,
      status: (e as { status?: number }).status,
    }),
  );
} finally {
  await mongoose.disconnect();
}
