import "dotenv/config";
import { validateRuntime } from "./store-mode";
validateRuntime();
import mongoose from "mongoose";
import { userByEmail, saveUser } from "./auth";
import { atomic, initializeRepository } from "./repository";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:promote -- your-registered-email");
  process.exit(1);
}
if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);
await initializeRepository();
await atomic(async () => {
  const user = await userByEmail(email);
  if (!user) throw new Error("Register this account first at /account.");
  await saveUser({ ...user, role: "admin" });
});
console.log("Registered account promoted to administrator.");
await mongoose.disconnect();
