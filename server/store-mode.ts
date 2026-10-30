import { isIP } from "node:net";
export type StoreMode = "demo" | "production";
export function storeMode(
  env: Record<string, string | undefined> = process.env,
): StoreMode {
  const value = env.STORE_MODE || "demo";
  if (value !== "demo" && value !== "production")
    throw new Error("STORE_MODE must be demo or production.");
  return value;
}
export function validateRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV === "production" && !env.STORE_MODE)
    throw new Error("Set STORE_MODE explicitly to demo or production.");
  const mode = storeMode(env);
  for (const key of ["CHECKOUT_RATE_MAX", "MAX_OUTSTANDING_COD"])
    if (
      env[key] &&
      (!/^\d+$/.test(env[key]!) ||
        Number(env[key]) < 1 ||
        Number(env[key]) > 100000)
    )
      throw new Error(`${key} must be an integer from 1 to 100000.`);
  if (mode === "production") {
    if (!env.MONGODB_URI)
      throw new Error(
        "Production store requires MONGODB_URI for a replica set / Atlas database.",
      );
    for (const key of ["WEB_ORIGIN", "PUBLIC_API_URL"]) {
      const value = env[key];
      if (!value || new URL(value).protocol !== "https:")
        throw new Error(`Production store requires HTTPS ${key}.`);
    }
    if (
      !env.CHECKOUT_IDENTITY_SECRET ||
      env.CHECKOUT_IDENTITY_SECRET.length < 32
    )
      throw new Error(
        "Production store requires CHECKOUT_IDENTITY_SECRET (at least 32 random characters, identical on every API instance).",
      );
  }
  if (
    env.TRUSTED_PROXY_CIDRS?.split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .some((v) => {
        v = v.trim();
        if (["loopback", "linklocal", "uniquelocal"].includes(v)) return false;
        const [ip, prefix, ...rest] = v.split("/");
        const family = isIP(ip);
        return (
          !family ||
          rest.length > 0 ||
          (prefix !== undefined &&
            (!/^\d+$/.test(prefix) ||
              Number(prefix) > (family === 4 ? 32 : 128)))
        );
      })
  )
    throw new Error(
      "TRUSTED_PROXY_CIDRS must contain explicit proxy IP/CIDR ranges, never true or a hop count.",
    );
  return mode;
}
