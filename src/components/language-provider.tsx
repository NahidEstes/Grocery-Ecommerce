"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Languages } from "lucide-react";
import { LANGUAGE_COOKIE, translate, type Locale } from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    if (next !== "en" && next !== "bn") return;
    document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    updateLocale(next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const t = useCallback(
    (source: string, values?: Record<string, string | number>) =>
      translate(locale, source, values),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const language = useContext(LanguageContext);
  if (!language) throw new Error("useLanguage requires LanguageProvider");
  return language;
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <label className="language-switcher">
      <Languages size={17} aria-hidden="true" />
      <span className="sr-only">Language / ভাষা</span>
      <select
        value={locale}
        disabled={!ready}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label="Language / ভাষা"
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="bn" lang="bn">
          বাংলা
        </option>
      </select>
    </label>
  );
}

export function SkipToContent() {
  const { t } = useLanguage();
  return (
    <a className="skip-link" href="#main-content">
      {t("Skip to content")}
    </a>
  );
}
