import bangla from "./locales/bn.json";

export type Locale = "en" | "bn";
export const LANGUAGE_COOKIE = "freshcart-language";

export function normalizeLocale(value: unknown): Locale {
  return value === "bn" ? "bn" : "en";
}

/** English source copy is the fallback for new or merchant-written content. */
export function translate(
  locale: Locale,
  source: string,
  values: Record<string, string | number> = {},
): string {
  const key = source.trim();
  const dictionary: Record<string, string> = bangla;
  const translated =
    locale === "bn" && Object.hasOwn(dictionary, key)
      ? source.replace(key, () => dictionary[key])
      : source;
  return translated.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );
}

export function localeTag(locale: Locale) {
  return locale === "bn" ? "bn-BD" : "en-GB";
}
