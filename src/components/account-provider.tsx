"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Account } from "@/lib/storefront";
import { api } from "@/lib/client-api";
import { forgetOrders } from "@/lib/order-browser";
import { BROWSER_DEMO } from "@/lib/browser-demo/config";
type State = {
  user: Account | null;
  ready: boolean;
  error: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: Account | null) => void;
};
const Context = createContext<State | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    if (BROWSER_DEMO) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const data = await api<{ user: Account | null }>("/auth/session");
      setUser(data.user);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Account service is unavailable.",
      );
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function signOut() {
    if (BROWSER_DEMO) return;
    await api("/auth/logout", { method: "POST", body: "{}" });
    forgetOrders();
    try {
      for (const key of [
        "freshcart-cart",
        "freshcart-addresses",
        "freshcart-orders",
        "freshcart-promo",
      ])
        localStorage.removeItem(key);
      sessionStorage.removeItem("freshcart-checkout");
    } catch {}
    setUser(null);
  }
  return (
    <Context.Provider value={{ user, ready, error, refresh, signOut, setUser }}>
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  const state = useContext(Context);
  if (!state) throw new Error("AccountProvider is required.");
  return state;
}
