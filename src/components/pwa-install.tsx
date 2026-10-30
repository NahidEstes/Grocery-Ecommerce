"use client";
import { useEffect, useState } from "react";
import { useShop } from "./shop-provider";
import { Download, RefreshCw, Smartphone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./language-provider";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function PwaInstall() {
  const { t } = useLanguage();
  const {
    settings: { profile },
  } = useShop();
  const path = usePathname();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [standalone, setStandalone] = useState(true),
    [dismissed, setDismissed] = useState(false),
    [instructions, setInstructions] = useState(false),
    [ios, setIos] = useState(false),
    [busy, setBusy] = useState(false),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const installed = () => {
      setStandalone(true);
      setPrompt(null);
    };
    const updateDisplay = () =>
      setStandalone(
        display.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const offer = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    updateDisplay();
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    try {
      setDismissed(
        localStorage.getItem("freshcart-install-dismissed") === "yes",
      );
    } catch {}
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    display.addEventListener("change", updateDisplay);
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let watch: (() => void) | undefined;
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      window.isSecureContext
    ) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((value) => {
          if (!active) return;
          registration = value;
          if (value.waiting) setWaiting(value.waiting);
          watch = () => {
            const installing = value.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                active &&
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaiting(value.waiting);
            });
          };
          value.addEventListener("updatefound", watch);
        })
        .catch(() => {
          /* Installation remains available without an offline shell. */
        });
    }
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
      display.removeEventListener("change", updateDisplay);
      if (watch) registration?.removeEventListener("updatefound", watch);
    };
  }, []);
  if (path.startsWith("/admin") || path.startsWith("/checkout")) return null;
  return (
    <>
      {waiting && (
        <div className="pwa-update" role="status">
          <RefreshCw size={18} />
          <span>
            {t(
              "A fresh version is ready. Finish your changes before reloading.",
            )}
          </span>
          <button
            className="button outline small"
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                { once: true },
              );
              waiting.postMessage({ type: "ACTIVATE_UPDATE" });
            }}
          >
            {t("Update & reload")}
          </button>
        </div>
      )}
      {!standalone && !dismissed && (
        <section
          className="pwa-install page-container"
          aria-label={`${t("Install")} ${profile.name}`}
        >
          <Smartphone size={34} />
          <div>
            <h2>{t("Your fresh market, one tap away.")}</h2>
            <p>{`${profile.name} · ${t("Add to your home screen for easy access.")}`}</p>
            {instructions && (
              <p role="status">
                {t(
                  ios
                    ? "In Safari, open Share, then choose Add to Home Screen."
                    : "Open your browser menu and choose Install app or Add to Home Screen, if available.",
                )}
              </p>
            )}
            {error && <p role="alert">{t(error)}</p>}
          </div>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setError("");
              if (!prompt) {
                setInstructions(true);
                return;
              }
              setBusy(true);
              try {
                await prompt.prompt();
                const choice = await prompt.userChoice;
                if (choice.outcome === "accepted") setStandalone(true);
                setPrompt(null);
              } catch {
                setError(t("Use your browser menu to install this store."));
                setInstructions(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={18} />
            {prompt ? `${t("Install")} ${profile.name}` : t("How to install")}
          </button>
          <button
            className="icon-button"
            aria-label={t("Dismiss install suggestion")}
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem("freshcart-install-dismissed", "yes");
              } catch {}
            }}
          >
            <X size={18} />
          </button>
        </section>
      )}
    </>
  );
}
