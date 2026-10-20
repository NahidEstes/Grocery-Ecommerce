import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import {
  publicUser,
  register,
  userByEmail,
  saveUser,
  checkPassword,
  hashPassword,
  createSession,
  currentUser,
  requireUser,
  logout,
  authRateLimit,
  digest,
} from "./auth";
import { atomic } from "./repository";
import { addressSchema, bad } from "./validation";
import { getCatalog, listOrders, findOrder, replaceOrder } from "./store";
import { tokenAccess, publicOrder } from "./checkout";
import { sanitizeCart } from "../src/lib/commerce";
import type { CartItem } from "../src/lib/commerce";
export const accountRoutes = Router();
const email = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const password = z.string().min(10).max(128);
accountRoutes.use("/auth", authRateLimit);
accountRoutes.post("/auth/register", async (req, res) => {
  const input = z
    .object({ name: z.string().trim().min(2).max(80), email, password })
    .parse(req.body);
  const user = await register(input.name, input.email, input.password);
  await createSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});
accountRoutes.post("/auth/login", async (req, res) => {
  const input = z
    .object({ email, password: z.string().min(1).max(128) })
    .parse(req.body);
  const user = await userByEmail(input.email);
  const valid = await checkPassword(
    input.password,
    user?.passwordHash || "invalid-salt:00",
  );
  if (!user || !valid) throw bad("Email or password is incorrect.", 401);
  await createSession(res, user);
  res.json({ user: publicUser(user) });
});
accountRoutes.post("/auth/logout", async (req, res) => {
  await logout(req, res);
  res.json({ ok: true });
});
accountRoutes.get("/auth/session", async (req, res) => {
  const user = await currentUser(req);
  res.json({
    user: user ? publicUser(user) : null,
    resetAvailable: !!process.env.SMTP_HOST,
  });
});
accountRoutes.post("/auth/forgot", async (req, res) => {
  const input = z.object({ email }).parse(req.body);
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
    throw bad(
      "Password reset email is not configured. Please contact the store.",
      503,
    );
  const user = await userByEmail(input.email);
  if (user) {
    const token = randomBytes(32).toString("hex");
    await atomic(async () => {
      const fresh = (await userByEmail(input.email))!;
      await saveUser({
        ...fresh,
        resetHash: digest(token),
        resetExpires: Date.now() + 30 * 60000,
      });
    });
    const link = `${process.env.WEB_ORIGIN || "http://127.0.0.1:3000"}/account?reset=${token}&email=${encodeURIComponent(user.email)}`;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: "Reset your FreshCart password",
      text: `Reset your password using this single-use link, valid for 30 minutes:\n${link}\n\nIf you did not request this, ignore this email.`,
    });
  }
  res.status(202).json({
    message: "If this email has an account, a reset link has been sent.",
  });
});
accountRoutes.post("/auth/reset", async (req, res) => {
  const input = z
    .object({ email, token: z.string().regex(/^[a-f0-9]{64}$/), password })
    .parse(req.body);
  const encoded = await hashPassword(input.password);
  await atomic(async () => {
    const user = await userByEmail(input.email);
    if (
      !user ||
      !user.resetHash ||
      user.resetHash !== digest(input.token) ||
      (user.resetExpires || 0) < Date.now()
    )
      throw bad("This reset link is invalid or expired.");
    await saveUser({
      ...user,
      passwordHash: encoded,
      resetHash: undefined,
      resetExpires: undefined,
    });
  });
  await logout(req, res);
  res.json({ message: "Password updated. Please sign in again." });
});
accountRoutes.get("/me", async (req, res) =>
  res.json({ user: publicUser(await requireUser(req)) }),
);
accountRoutes.patch("/me", async (req, res) => {
  const user = await requireUser(req);
  const input = z
    .object({
      name: z.string().trim().min(2).max(80),
      addresses: z.array(addressSchema).max(8),
    })
    .parse(req.body);
  const updated = await atomic(async () => {
    const fresh = (await userByEmail(user.email))!;
    const updated = { ...fresh, ...input };
    await saveUser(updated);
    return updated;
  });
  res.json({ user: publicUser(updated) });
});
accountRoutes.get("/me/orders", async (req, res) => {
  const user = await requireUser(req);
  res.json({
    orders: (await listOrders())
      .filter((o) => o.userId === user.id)
      .map(publicOrder),
  });
});
accountRoutes.post("/me/import", async (req, res) => {
  const user = await requireUser(req);
  const input = z
    .object({
      addresses: z.array(addressSchema).max(8),
      items: z
        .array(
          z.object({
            productId: z.string().max(60),
            quantity: z.number().int().min(1).max(100000),
          }),
        )
        .max(100),
      receipts: z
        .array(
          z.object({
            reference: z.string().max(30),
            accessToken: z.string().max(128),
          }),
        )
        .max(30),
    })
    .parse(req.body);
  const updated = await atomic(async () => {
    const fresh = (await userByEmail(user.email))!;
    const addresses = [...fresh.addresses];
    for (const address of input.addresses)
      if (
        !addresses.some(
          (a) => a.address === address.address && a.area === address.area,
        ) &&
        addresses.length < 8
      )
        addresses.push(address);
    const saved = {
      ...fresh,
      addresses,
      cart: sanitizeCart(
        [...(fresh.cart || []), ...input.items],
        await getCatalog(),
      ),
    };
    await saveUser(saved);
    for (const receipt of input.receipts) {
      const order = await findOrder(receipt.reference);
      if (order && !order.userId && tokenAccess(order, receipt.accessToken))
        await replaceOrder({ ...order, userId: user.id, email: user.email });
    }
    return saved;
  });
  res.json({ user: publicUser(updated), items: updated.cart });
});
accountRoutes.get("/me/cart", async (req, res) => {
  const user = await requireUser(req);
  res.json({ items: sanitizeCart(user.cart || [], await getCatalog()) });
});
accountRoutes.put("/me/cart", async (req, res) => {
  const user = await requireUser(req);
  const input = z
    .object({
      items: z
        .array(
          z.object({
            productId: z.string().max(60),
            quantity: z.number().int().min(0).max(100000),
          }),
        )
        .max(100),
    })
    .parse(req.body);
  await atomic(async () => {
    const fresh = (await userByEmail(user.email))!;
    await saveUser({
      ...fresh,
      cart: sanitizeCart(input.items, await getCatalog()),
    });
  });
  res.json({ ok: true });
});
