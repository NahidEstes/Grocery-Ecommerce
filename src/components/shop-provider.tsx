"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Product } from "@/lib/catalog";
import { sanitizeCart, type CartItem } from "@/lib/commerce";

type ShopState = {
  catalog: Product[];
  items: CartItem[];
  ready: boolean;
  saved: string[];
  area: string;
  toast: string;
  setArea: (area: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  addItem: (id: string, quantity?: number) => void;
  clearCart: () => void;
  toggleSaved: (id: string) => void;
  notify: (message: string) => void;
};
const ShopContext = createContext<ShopState | null>(null);
export function ShopProvider({
  catalog,
  children,
}: {
  catalog: Product[];
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [area, updateArea] = useState("Dhanmondi");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    try {
      setItems(
        sanitizeCart(
          JSON.parse(localStorage.getItem("freshcart-cart") || "[]"),
          catalog,
        ),
      );
      const storedSaved: unknown = JSON.parse(
        localStorage.getItem("freshcart-saved") || "[]",
      );
      if (Array.isArray(storedSaved))
        setSaved(
          storedSaved.filter(
            (id): id is string =>
              typeof id === "string" && catalog.some((p) => p.id === id),
          ),
        );
      const storedArea = localStorage.getItem("freshcart-area");
      if (
        storedArea &&
        ["Dhanmondi", "Mirpur", "Uttara", "Gulshan"].includes(storedArea)
      )
        updateArea(storedArea);
    } catch {
      /* Corrupt browser storage safely starts with an empty basket. */
    }
    setReady(true);
  }, [catalog]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("freshcart-cart", JSON.stringify(items));
      localStorage.setItem("freshcart-saved", JSON.stringify(saved));
      localStorage.setItem("freshcart-area", area);
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
  }, [items, saved, area, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  function setQuantity(id: string, quantity: number) {
    setItems((previous) =>
      sanitizeCart(
        previous.some((item) => item.productId === id)
          ? previous.map((item) =>
              item.productId === id ? { productId: id, quantity } : item,
            )
          : [...previous, { productId: id, quantity }],
        catalog,
      ),
    );
  }
  function addItem(id: string, quantity = 1) {
    const product = catalog.find((p) => p.id === id);
    if (!product) return;
    setItems((previous) =>
      sanitizeCart([...previous, { productId: id, quantity }], catalog),
    );
    setToast(`${product.name} added to your cart`);
  }
  function toggleSaved(id: string) {
    setSaved((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }
  return (
    <ShopContext.Provider
      value={{
        catalog,
        items,
        ready,
        saved,
        area,
        toast,
        setArea: updateArea,
        setQuantity,
        addItem,
        clearCart: () => setItems([]),
        toggleSaved,
        notify: setToast,
      }}
    >
      {children}
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </ShopContext.Provider>
  );
}
const subscribeHydration = () => () => {};
export function useShop() {
  const value = useContext(ShopContext);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  if (!value) throw new Error("ShopProvider is required.");
  // Each deferred boundary hydrates against the same empty basket as its server HTML.
  return hydrated
    ? value
    : { ...value, items: [], saved: [], area: "Dhanmondi", ready: false };
}
