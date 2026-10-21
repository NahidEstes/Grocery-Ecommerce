"use client";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useShop } from "./shop-provider";
import { useAccount } from "./account-provider";
import { planBasket } from "@/lib/shopping";
import type { CartItem } from "@/lib/commerce";

export function AddSelection({
  items,
  label = "Add available items",
  strict = false,
  className = "button primary",
  onAdded,
}: {
  items: CartItem[];
  label?: string;
  strict?: boolean;
  className?: string;
  onAdded?: () => void;
}) {
  const { ready, addMany, refreshCatalog, items: cart, notify } = useShop();
  const { user } = useAccount();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setError("");
  }, [user?.id]);
  return (
    <div className="add-selection">
      <button
        className={className}
        disabled={!ready || busy || !items.length}
        onClick={async () => {
          const requestOwner = owner.current,
            requestGeneration = generation.current;
          const currentRequest = () =>
            owner.current === requestOwner &&
            generation.current === requestGeneration;
          setBusy(true);
          setError("");
          try {
            const current = await refreshCatalog();
            if (!currentRequest()) return;
            const planned = planBasket(items, current, cart);
            if (strict && planned.issues.length)
              throw new Error(
                "Some selected packs exceed current stock. Adjust your selection or basket.",
              );
            if (!planned.additions.length)
              throw new Error(
                "No additional packs are available. Check stock and quantities already in your basket.",
              );
            if (addMany(planned.additions, strict, current)) {
              if (planned.issues.length) {
                const names = planned.issues.map(
                  (i) =>
                    current.find((p) => p.id === i.productId)?.name ||
                    "Unavailable item",
                );
                setError(
                  `Added available quantities. Please review: ${[...new Set(names)].join(", ")}.`,
                );
                notify(
                  "Available quantities added. Review the items with stock limits.",
                );
              }
              onAdded?.();
            }
          } catch (e) {
            if (currentRequest()) setError((e as Error).message);
          } finally {
            if (currentRequest()) setBusy(false);
          }
        }}
      >
        <ShoppingCart size={17} />
        {busy ? "Checking price & stock…" : label}
      </button>
      {error && (
        <p className="selection-message" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
