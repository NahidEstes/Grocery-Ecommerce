import type { Product } from "./catalog";
export const productColumns = [
  "id",
  "slug",
  "name",
  "category",
  "unit",
  "price",
  "originalPrice",
  "stock",
  "atlas",
  "lowStockThreshold",
  "brand",
  "description",
  "imageUrl",
  "parentId",
  "measure",
  "measureUnit",
  "active",
  "seasonal",
  "organic",
  "searchTerms",
  "dietary",
  "origin",
  "nutrition",
  "allergens",
  "storage",
  "version",
] as const;
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell) throw new Error("Unexpected quote in CSV.");
      else {
        if (quoted && text[i + 1] && !/[\r\n,]/.test(text[i + 1]))
          throw new Error("Unexpected text after closing CSV quote.");
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function safeCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function exportProducts(products: Product[]) {
  return (
    "\uFEFF" +
    [
      productColumns.join(","),
      ...products.map((p) =>
        productColumns
          .map((key) =>
            safeCell(
              key === "searchTerms" || key === "dietary"
                ? (p[key] || []).join("|")
                : key === "version"
                  ? p.version || 0
                  : p[key],
            ),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function importProducts(text: string, current: Product[]): Product[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, "")),
    headers = rows.shift()?.map((h) => h.trim());
  if (!headers?.includes("id") || new Set(headers).size !== headers.length)
    throw new Error("CSV needs unique column headers including id.");
  if (headers.some((h) => !(productColumns as readonly string[]).includes(h)))
    throw new Error(
      "Unknown CSV column. Download an export to use as a template.",
    );
  if (rows.length > 100 || !rows.length)
    throw new Error("Import between 1 and 100 products.");
  const numeric = [
      "price",
      "originalPrice",
      "stock",
      "atlas",
      "lowStockThreshold",
      "measure",
      "version",
    ],
    booleans = ["active", "seasonal", "organic"];
  return rows.map((row, index) => {
    if (row.length !== headers.length)
      throw new Error(`Row ${index + 2}: column count does not match.`);
    const values = Object.fromEntries(headers.map((h, i) => [h, row[i]])),
      old = current.find((p) => p.id === values.id);
    if (old && !headers.includes("version"))
      throw new Error(
        `Row ${index + 2}: version is required when updating a SKU.`,
      );
    const result: Record<string, unknown> = { ...(old || {}) };
    for (const [key, raw] of Object.entries(values)) {
      let v =
        raw.startsWith("'") && /^[=+@\-]/.test(raw.slice(1))
          ? raw.slice(1)
          : raw;
      if (numeric.includes(key)) {
        if (!v) {
          delete result[key];
          continue;
        }
        if (!Number.isFinite(Number(v)))
          throw new Error(`Row ${index + 2}: invalid ${key}.`);
        result[key] = Number(v);
      } else if (booleans.includes(key)) {
        if (v && !["true", "false"].includes(v))
          throw new Error(`Row ${index + 2}: ${key} must be true or false.`);
        result[key] = v === "true";
      } else if (key === "searchTerms" || key === "dietary")
        result[key] = v
          .split("|")
          .map((v) => v.trim())
          .filter(Boolean);
      else if (v || !["parentId", "measureUnit"].includes(key)) result[key] = v;
      else delete result[key];
    }
    result.atlas = result.atlas ?? old?.atlas ?? 0;
    result.rating = 0;
    return result as Product;
  });
}
