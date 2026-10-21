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
import {
  defaultSettings,
  type StoreSettings,
  type Review,
} from "@/lib/storefront";
import { useAccount } from "./account-provider";
import { api } from "@/lib/client-api";
import { useRef } from "react";
import { usePathname } from "next/navigation";

type ShopState = {
  miniCartOpen: boolean;
  setMiniCartOpen: (open: boolean) => void;
  settings: StoreSettings;
  payments: { enabled: boolean; sandbox: boolean };
  popularIds: string[];
  reviews: Omit<Review, "userId" | "reference">[];
  storeError: string;
  addMany: (
    items: CartItem[],
    strict?: boolean,
    currentCatalog?: Product[],
  ) => boolean;
  refreshCatalog: () => Promise<Product[]>;
  catalog: Product[];
  items: CartItem[];
  ready: boolean;
  saved: string[];
  area: string;
  toast: string;
  promoCode: string;
  setPromoCode: (code: string) => void;
  setArea: (area: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  addItem: (id: string, quantity?: number) => void;
  clearCart: () => void;
  toggleSaved: (id: string) => void;
  notify: (message: string) => void;
};
const ShopContext = createContext<ShopState | null>(null);
export function ShopProvider({
  catalog: initialCatalog,
  children,
}: {
  catalog: Product[];
  children: ReactNode;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const path = usePathname();
  const [items, setItemsState] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);
  function setItems(next: CartItem[] | ((previous: CartItem[]) => CartItem[])) {
    const value = typeof next === "function" ? next(itemsRef.current) : next;
    itemsRef.current = value;
    setItemsState(value);
  }
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  async function refreshCatalog() {
    const data = await api<{ products: Product[] }>("/catalog");
    setCatalog(data.products);
    return data.products;
  }
  useEffect(() => {
    void refreshCatalog().catch(() => {});
  }, [path]);
  const [ready, setReady] = useState(false);
  const { user, ready: accountReady } = useAccount();
  const [settings, setSettings] = useState(defaultSettings);
  const [payments, setPayments] = useState({ enabled: false, sandbox: true });
  const [popularIds, setPopularIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<
    Omit<Review, "userId" | "reference">[]
  >([]);
  const [storeError, setStoreError] = useState("");
  const loadedAccount = useRef<string | null>(null);
  const priorAccount = useRef<string | null>(null);
  const [cartLoadedFor, setCartLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    api<{
      settings: StoreSettings;
      payments: { enabled: boolean; sandbox: boolean };
      popularIds: string[];
      reviews: Omit<Review, "userId" | "reference">[];
    }>("/storefront")
      .then((data) => {
        setSettings(data.settings);
        setPayments(data.payments);
        setPopularIds(data.popularIds);
        setReviews(data.reviews);
        setStoreError("");
      })
      .catch(() =>
        setStoreError(
          "Store updates are unavailable. Please retry before checkout.",
        ),
      );
  }, [catalog]);
  useEffect(() => {
    if (!accountReady || !ready) return;
    const controller = new AbortController();
    if (user) {
      loadedAccount.current = null;
      api<{ items: CartItem[] }>("/me/cart", { signal: controller.signal })
        .then((data) => {
          setItems(sanitizeCart(data.items, catalog));
          loadedAccount.current = user.id;
          priorAccount.current = user.id;
          setCartLoadedFor(user.id);
        })
        .catch((error) => {
          if (error.name !== "AbortError")
            setToast(
              "Your saved basket could not be loaded. Please refresh before shopping.",
            );
        });
    } else {
      loadedAccount.current = null;
      setCartLoadedFor(null);
      if (priorAccount.current) {
        setItems([]);
        setSaved([]);
        setPromoCode("");
        priorAccount.current = null;
      }
    }
    return () => controller.abort();
  }, [accountReady, user?.id, ready]);
  useEffect(() => {
    if (!user || loadedAccount.current !== user.id) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api("/me/cart", {
        method: "PUT",
        body: JSON.stringify({ items }),
        signal: controller.signal,
      }).catch(() => {});
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [items, user?.id]);
  const [saved, setSaved] = useState<string[]>([]);
  const [area, updateArea] = useState("Dhanmondi");
  const [toast, setToast] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const canShop = ready && accountReady && (!user || cartLoadedFor === user.id);
  useEffect(() => {
    if (!ready) return;
    setItems((previous) => {
      const next = sanitizeCart(previous, catalog);
      return JSON.stringify(next) === JSON.stringify(previous)
        ? previous
        : next;
    });
  }, [catalog, ready]);
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
      const storedPromo = localStorage.getItem("freshcart-promo");
      if (storedPromo && /^[A-Z0-9]{3,20}$/.test(storedPromo))
        setPromoCode(storedPromo);
      if (
        storedArea &&
        ["Dhanmondi", "Mirpur", "Uttara", "Gulshan"].includes(storedArea)
      )
        updateArea(storedArea);
    } catch {
      /* Corrupt browser storage safely starts with an empty basket. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("freshcart-cart", JSON.stringify(items));
      localStorage.setItem("freshcart-saved", JSON.stringify(saved));
      localStorage.setItem("freshcart-area", area);
      localStorage.setItem("freshcart-promo", promoCode);
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
  }, [items, saved, area, ready, promoCode]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  function setQuantity(id: string, quantity: number) {
    if (!canShop) {
      setToast(
        "Your saved basket is still loading. Please try again in a moment.",
      );
      return;
    }
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
    if (!canShop) {
      setToast(
        "Your saved basket is still loading. Please try again in a moment.",
      );
      return;
    }
    const product = catalog.find((p) => p.id === id);
    if (!product || product.active === false || product.stock < 1) {
      setToast("This product is currently unavailable.");
      return;
    }
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
  function addMany(
    incoming: CartItem[],
    strict = false,
    currentCatalog = catalog,
  ) {
    if (!canShop) {
      setToast(
        "Your saved basket is still loading. Please try again in a moment.",
      );
      return false;
    }
    const desired = new Map(
      itemsRef.current.map((i) => [i.productId, i.quantity]),
    );
    for (const item of incoming)
      desired.set(
        item.productId,
        (desired.get(item.productId) || 0) + item.quantity,
      );
    const unavailable = [...desired].filter(([id, q]) => {
      const p = currentCatalog.find((p) => p.id === id);
      return !p || p.active === false || q > p.stock;
    });
    if (strict && unavailable.length) {
      setToast(
        "This bundle exceeds available stock. Please check your basket.",
      );
      return false;
    }
    const next = sanitizeCart(
      [...desired].map(([productId, quantity]) => ({ productId, quantity })),
      currentCatalog.filter((p) => p.active !== false),
    );
    setItems(next);
    setToast(
      unavailable.length
        ? "Available quantities added at current prices. Some items were unavailable or limited."
        : "Added to your basket at current prices.",
    );
    return true;
  }
  return (
    <ShopContext.Provider
      value={{
        miniCartOpen,
        setMiniCartOpen,
        settings,
        payments,
        popularIds,
        reviews,
        storeError,
        addMany,
        refreshCatalog,
        catalog,
        items: sanitizeCart(items, catalog),
        ready: canShop,
        saved,
        area,
        toast,
        promoCode,
        setPromoCode,
        setArea: updateArea,
        setQuantity,
        addItem,
        clearCart: () => {
          setItems([]);
          setPromoCode("");
        },
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
    : {
        ...value,
        items: [],
        saved: [],
        area: "Dhanmondi",
        promoCode: "",
        ready: false,
      };
}
