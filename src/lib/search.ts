import type { Product } from "./catalog";

const vocabulary: Record<string, string[]> = {
  banana: ["banana", "bananas", "কলা", "kola"],
  apple: ["apple", "apples", "আপেল", "apel"],
  tomato: ["tomato", "tomatoes", "টমেটো", "টমেটা", "টমাটো"],
  carrot: ["carrot", "carrots", "গাজর", "gajor"],
  broccoli: ["broccoli", "ব্রকলি", "ব্রোকলি"],
  orange: ["orange", "oranges", "কমলা", "komola"],
  cucumber: ["cucumber", "cucumbers", "শসা", "shosha"],
  potato: ["potato", "potatoes", "আলু", "aloo", "alu"],
  milk: ["milk", "দুধ", "dudh"],
  bread: ["bread", "রুটি", "পাউরুটি", "পাউরুটী", "ruti", "pauruti"],
  egg: ["egg", "eggs", "ডিম", "dim"],
  soyabean: ["soyabean", "soybean", "সয়াবিন", "সয়াবিন", "সয়াবীন"],
  oil: ["oil", "তেল", "tel"],
  kg: ["kg", "কেজি", "কিলোগ্রাম"],
  litre: ["litre", "liter", "লিটার"],
};
export function normalizeSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[০-৯]/g, (n) => String("০১২৩৪৫৬৭৮৯".indexOf(n)))
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function canonical(token: string) {
  return (
    Object.keys(vocabulary).find((key) =>
      vocabulary[key].some((v) => normalizeSearch(v) === token),
    ) || token
  );
}
function words(product: Product) {
  const text = normalizeSearch(
    `${product.name} ${product.brand || ""} ${product.category} ${product.unit} ${product.description} ${(product.searchTerms || []).join(" ")} ${Object.values(
      product.translations?.bn || {},
    )
      .filter((v) => v.text && v.source)
      .map((v) => v.text)
      .join(" ")}`,
  );
  const tokens = text.split(" ");
  const canonicalTokens = tokens.map(canonical);
  const extra = Object.entries(vocabulary)
    .filter(([key]) => canonicalTokens.includes(key))
    .flatMap(([, values]) => values.map(normalizeSearch));
  return { text, tokens: [...tokens, ...canonicalTokens, ...extra] };
}
export function searchScore(product: Product, query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return 0;
  const document = words(product),
    terms = normalized.split(" ");
  if (
    !terms.every((term) =>
      document.tokens.some(
        (word) => word.startsWith(term) || word.startsWith(canonical(term)),
      ),
    )
  )
    return -1;
  const name = normalizeSearch(product.name);
  return (
    (name === normalized ? 100 : 0) +
    (name.startsWith(normalized) ? 50 : 0) +
    terms.reduce(
      (score, term) =>
        score + (document.tokens.includes(canonical(term)) ? 10 : 3),
      0,
    )
  );
}
export function searchProducts(catalog: Product[], query: string, limit = 6) {
  if (!normalizeSearch(query)) return [];
  return catalog
    .filter((p) => p.active !== false && !p.parentId)
    .map((p) => ({ product: p, score: searchScore(p, query) }))
    .filter((p) => p.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name),
    )
    .slice(0, limit)
    .map((p) => p.product);
}
