import { BROWSER_DEMO } from "./browser-demo/config";
export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (BROWSER_DEMO) {
    const { demoApi } = await import("./browser-demo/adapter");
    return demoApi<T>(path, options);
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.headers.get("X-FreshCart-Service") !== "freshcart-api")
    throw new Error("FreshCart is temporarily unavailable. Please try again.");
  const data = await response.json().catch(() => {
    throw new Error("FreshCart returned an unexpected response. Please retry.");
  });
  if (!response.ok)
    throw Object.assign(
      new Error(data.message || "Unable to complete this request."),
      { status: response.status },
    );
  return data as T;
}
