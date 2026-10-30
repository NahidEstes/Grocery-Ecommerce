import { DEMO_PREFIX, demoKey } from "./config";

// In-memory fallback supports navigation when browser storage is blocked. It is
// intentionally not durable across reloads; the UI reports that limitation.
const memory = new Map<string, unknown>();
const volatile = new Set<string>();
export function reportDemoStorageFailure() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("freshcart-demo-storage-unavailable"));
}
export function readDemo<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): T {
  if (volatile.has(key)) {
    const value = memory.get(key);
    return valid(value) ? value : fallback;
  }
  try {
    const raw = localStorage.getItem(demoKey(key));
    if (raw !== null) {
      const value: unknown = JSON.parse(raw);
      return valid(value) ? value : fallback;
    }
  } catch {
    /* blocked or corrupt storage */
  }
  const value = memory.get(key);
  return valid(value) ? value : fallback;
}
export function writeDemo(key: string, value: unknown): boolean {
  memory.set(key, value);
  try {
    localStorage.setItem(demoKey(key), JSON.stringify(value));
    volatile.delete(key);
    return true;
  } catch {
    // A previous durable receipt list must not hide this session's new receipt
    // when only writes are blocked (quota exhausted).
    volatile.add(key);
    reportDemoStorageFailure();
    return false;
  }
}
export function resetDemo() {
  memory.clear();
  volatile.clear();
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i),
    );
    for (const key of keys)
      if (key?.startsWith(DEMO_PREFIX)) localStorage.removeItem(key);
  } catch {
    /* only the in-memory session can be reset when storage is blocked */
  }
}
