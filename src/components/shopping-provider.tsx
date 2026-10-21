"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "./account-provider";
import { api } from "@/lib/client-api";
import type { ShoppingList, ShoppingSummary } from "@/lib/shopping";
const empty: ShoppingSummary = { regular: [], activeOrder: null, lists: [] };
type State = ShoppingSummary & {
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  recordList: (list: ShoppingList) => void;
};
const Context = createContext<State | null>(null);
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAccount(),
    path = usePathname();
  const [snapshot, setSnapshot] = useState({ owner: "", data: empty }),
    [loading, setLoading] = useState(false),
    [failure, setFailure] = useState({ owner: "", message: "" });
  const sequence = useRef(0),
    owner = useRef(user?.id);
  owner.current = user?.id;
  const refresh = useCallback(async () => {
    if (!user) {
      setSnapshot({ owner: "", data: empty });
      setFailure({ owner: "", message: "" });
      setLoading(false);
      return;
    }
    const request = ++sequence.current,
      ownerId = user.id;
    setLoading(true);
    try {
      const data = await api<ShoppingSummary>("/me/shopping");
      if (request === sequence.current && owner.current === ownerId) {
        setSnapshot({ owner: ownerId, data });
        setFailure({ owner: ownerId, message: "" });
      }
    } catch (e) {
      if (request === sequence.current && owner.current === ownerId) {
        setFailure({ owner: ownerId, message: (e as Error).message });
        if ((e as { status?: number }).status === 401)
          setSnapshot({ owner: ownerId, data: empty });
      }
    } finally {
      if (request === sequence.current && owner.current === ownerId)
        setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    if (ready) void refresh();
    return () => {
      sequence.current++;
    };
  }, [ready, path, refresh]);
  useEffect(() => {
    if (!user) return;
    const check = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [user?.id, refresh]);
  function recordList(list: ShoppingList) {
    const id = user?.id;
    if (!id || owner.current !== id) return;
    sequence.current++;
    setLoading(false);
    setSnapshot((previous) => ({
      owner: id,
      data: {
        ...(previous.owner === id ? previous.data : empty),
        lists: [
          list,
          ...(previous.owner === id ? previous.data.lists : []).filter(
            (v) => v.id !== list.id,
          ),
        ],
      },
    }));
  }
  const data = user && snapshot.owner === user.id ? snapshot.data : empty;
  return (
    <Context.Provider
      value={{
        ...data,
        loading:
          !ready ||
          (!!user &&
            (loading ||
              (snapshot.owner !== user.id &&
                !(failure.owner === user.id && failure.message)))),
        error: user && failure.owner === user.id ? failure.message : "",
        refresh,
        recordList,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useShopping() {
  const value = useContext(Context);
  if (!value) throw new Error("ShoppingProvider is required.");
  return value;
}
