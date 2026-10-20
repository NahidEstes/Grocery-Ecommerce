import type { Request, Response, NextFunction } from "express";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { Account } from "../src/lib/storefront";
import { atomic, readEntity, writeEntity, deleteEntity } from "./repository";
const scrypt = promisify(scryptCallback);
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export type UserRecord = Account & {
  passwordHash: string;
  resetHash?: string;
  resetExpires?: number;
  cart?: import("../src/lib/commerce").CartItem[];
};
type Session = { userId: string; expires: number; version: string };
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [salt, hex] = encoded.split(":");
  const key = (await scrypt(password, salt || "invalid-salt", 64)) as Buffer;
  const expected = Buffer.from(hex || "", "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export const publicUser = (u: UserRecord): Account => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  addresses: u.addresses,
  createdAt: u.createdAt,
});
export const userByEmail = (email: string) =>
  readEntity<UserRecord>(`user:${digest(email.toLowerCase())}`);
export const userById = async (id: string) => {
  const email = await readEntity<string>(`user-id:${id}`);
  return email ? userByEmail(email) : null;
};
export async function saveUser(user: UserRecord) {
  await writeEntity(`user:${digest(user.email)}`, user);
  await writeEntity(`user-id:${user.id}`, user.email);
}
export async function register(name: string, email: string, password: string) {
  const passwordHash = await hashPassword(password);
  return atomic(async () => {
    if (await userByEmail(email))
      throw Object.assign(
        new Error("An account with this email already exists."),
        { status: 409 },
      );
    const user: UserRecord = {
      id: randomUUID(),
      name,
      email,
      role: "customer",
      addresses: [],
      createdAt: new Date().toISOString(),
      passwordHash,
    };
    await saveUser(user);
    return user;
  });
}
function sessionCookie(req: Request) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("freshcart_session="))
      ?.slice("freshcart_session=".length) || ""
  );
}
export async function currentUser(req: Request) {
  const token = sessionCookie(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const key = `session:${digest(token)}`;
  const session = await readEntity<Session>(key);
  if (!session) return null;
  const user = await userById(session.userId);
  if (
    session.expires < Date.now() ||
    !user ||
    session.version !== digest(user.passwordHash)
  ) {
    await deleteEntity(key);
    return null;
  }
  return user;
}
export async function createSession(res: Response, user: UserRecord) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + 7 * 86400_000;
  await writeEntity(`session:${digest(token)}`, {
    userId: user.id,
    expires,
    version: digest(user.passwordHash),
  });
  res.cookie("freshcart_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.WEB_ORIGIN?.startsWith("https://"),
    path: "/",
    maxAge: 7 * 86400_000,
  });
}
export async function logout(req: Request, res: Response) {
  await deleteEntity(`session:${digest(sessionCookie(req))}`);
  res.clearCookie("freshcart_session", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.WEB_ORIGIN?.startsWith("https://"),
  });
}
export async function requireUser(req: Request) {
  const user = await currentUser(req);
  if (!user)
    throw Object.assign(new Error("Please sign in to continue."), {
      status: 401,
    });
  return user;
}
export async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  if (user.role !== "admin")
    throw Object.assign(new Error("Administrator access is required."), {
      status: 403,
    });
  return user;
}
const attempts = new Map<string, { count: number; expires: number }>();
export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, v] of attempts) if (v.expires < now) attempts.delete(key);
  const key = `${req.ip || "local"}:${digest(String(req.body?.email || "").toLowerCase())}`;
  const entry = attempts.get(key) || { count: 0, expires: now + 15 * 60_000 };
  entry.count++;
  attempts.set(key, entry);
  if (entry.count > 40) {
    res.set("Retry-After", String(Math.ceil((entry.expires - now) / 1000)));
    res
      .status(429)
      .json({ message: "Too many attempts. Try again in 15 minutes." });
    return;
  }
  next();
}
