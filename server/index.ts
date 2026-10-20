import "dotenv/config";
import mongoose from "mongoose";
import { app } from "./app";
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch {
    console.error(
      "MongoDB connection failed. Check MONGODB_URI. API was not started.",
    );
    process.exit(1);
  }
}
const port = Number(process.env.API_PORT) || 4100;
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
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
  });
