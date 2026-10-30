import { createHmac } from "node:crypto";
import type { Request } from "express";
import { atomic, readEntity, writeEntity } from "./repository";
import { bad } from "./validation";
import { listOrders } from "./store";
import { normalizePhone } from "../src/lib/store-profile";
import { getSettings } from "./store";
const keyHash = (value: string) =>
  createHmac(
    "sha256",
    process.env.CHECKOUT_IDENTITY_SECRET ||
      "freshcart-local-demo-identity-only",
  )
    .update(value)
    .digest("hex");
export async function checkoutRateLimit(req: Request) {
  const limit = Number(process.env.CHECKOUT_RATE_MAX) || 30,
    windowMs = 15 * 60000;
  return atomic(async () => {
    // Express only accepts forwarded IPs from explicitly configured upstream proxies.
    const key = `checkout-rate:${keyHash(req.ip || req.socket.remoteAddress || "unknown")}`;
    const now = Date.now(),
      old = await readEntity<{ count: number; expires: number }>(key);
    const next =
      old && old.expires > now
        ? { ...old, count: old.count + 1 }
        : { count: 1, expires: now + windowMs };
    if (next.count > limit)
      throw Object.assign(
        bad(
          "Too many checkout attempts. Retry this same attempt after the indicated delay.",
          429,
        ),
        { retryAfter: Math.ceil((next.expires - now) / 1000) },
      );
    await writeEntity(key, next);
  });
}
export async function outstandingCodGuard(phone: string) {
  const settings = await getSettings(),
    normalized = normalizePhone(phone, settings.profile);
  const limit = Number(process.env.MAX_OUTSTANDING_COD) || 3;
  const outstanding = (await listOrders()).filter(
    (o) =>
      o.payment === "cash-on-delivery" &&
      !["delivered", "cancelled"].includes(o.status) &&
      normalizePhone(o.customer.phone, settings.profile) === normalized,
  );
  if (outstanding.length >= limit)
    throw bad(
      "This customer already has the maximum number of outstanding cash-on-delivery orders. Contact the store before placing another.",
      429,
    );
  // Shared identity document makes concurrent transactions on different instances conflict/retry.
  const key = `cod-fence:${keyHash(normalized)}`,
    old = await readEntity<{ revision: number }>(key);
  await writeEntity(key, { revision: (old?.revision || 0) + 1 });
}
