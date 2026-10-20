import "dotenv/config";
import mongoose from "mongoose";
import { app } from "./app";
import { initializeRepository } from "./repository";
import { atomic } from "./repository";
import { expirePending } from "./checkout";
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid")
      throw new Error("MongoDB transactions require a replica set.");
  } catch {
    console.error(
      "MongoDB connection failed or transactions are unavailable. Use a replica set / Atlas and check MONGODB_URI. API was not started.",
    );
    process.exit(1);
  }
}
const port = Number(process.env.API_PORT) || 4100;
await initializeRepository();
const reservationTimer = setInterval(() => {
  void atomic(expirePending).catch(() =>
    console.error("Unable to expire old payment reservations."),
  );
}, 60_000);
reservationTimer.unref();
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `FreshCart API: http://127.0.0.1:${port} (${mongoose.connection.readyState === 1 ? "MongoDB" : "demo catalog"})`,
  ),
);
server.on("error", (error) => {
  console.error(
    `FreshCart API could not start on port ${port}: ${error.message}`,
  );
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    clearInterval(reservationTimer);
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
  });
