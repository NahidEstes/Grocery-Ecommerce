export type CheckoutAttempt = {
  payload: string;
  requestId: string;
  accessToken: string;
  owner: string;
  createdAt: number;
};
const key = "freshcart-checkout-attempt-v1";
const ownerKey = (owner: string) => `${key}:${owner}`;
export function readCheckoutAttempt(owner: string): CheckoutAttempt | null {
  try {
    const a = JSON.parse(
      localStorage.getItem(ownerKey(owner)) ||
        localStorage.getItem(key) ||
        "null",
    );
    return a &&
      a.owner === owner &&
      typeof a.payload === "string" &&
      a.payload.length < 30000 &&
      /^[a-f0-9-]{36}$/.test(a.requestId) &&
      /^[a-f0-9-]{36}$/.test(a.accessToken) &&
      Number.isFinite(a.createdAt) &&
      a.createdAt <= Date.now() + 60000
      ? a
      : null;
  } catch {
    return null;
  }
}
export function saveCheckoutAttempt(attempt: CheckoutAttempt) {
  localStorage.setItem(ownerKey(attempt.owner), JSON.stringify(attempt));
}
export function forgetCheckoutAttempt(owner = "guest") {
  try {
    localStorage.removeItem(ownerKey(owner));
    const legacy = JSON.parse(localStorage.getItem(key) || "null");
    if (legacy?.owner === owner) localStorage.removeItem(key);
  } catch {}
}
export function prepareCheckoutAttempt(
  owner: string,
  payload: string,
  previous: CheckoutAttempt | null,
): CheckoutAttempt {
  // Even an edited basket keeps the unresolved attempt ID. If an earlier in-flight
  // POST wins the race, the server returns a conflict and we recover that order.
  return previous?.owner === owner
    ? { ...previous, payload }
    : {
        owner,
        payload,
        requestId: crypto.randomUUID(),
        accessToken: crypto.randomUUID(),
        createdAt: Date.now(),
      };
}
