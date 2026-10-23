import { randomUUID } from "node:crypto";
import { readEntity, writeEntity } from "./repository";
import {
  defaultContent,
  type AuditEvent,
  type StockEvent,
  type ContentConfig,
} from "../src/lib/management";
import { recipes, type Recipe } from "../src/lib/recipes";
export const getContent = async () => {
  const saved = await readEntity<ContentConfig>("content");
  if (saved) return saved;
  const initial = structuredClone(defaultContent),
    legacy =
      await readEntity<import("../src/lib/storefront").StoreSettings>(
        "settings",
      );
  if (legacy)
    initial.sections = initial.sections.map((s) => ({
      ...s,
      enabled:
        s.id in legacy.homeSections
          ? legacy.homeSections[s.id as keyof typeof legacy.homeSections]
          : s.enabled,
    }));
  return initial;
};
export const getRecipes = async () =>
  (await readEntity<Recipe[]>("recipes")) || structuredClone(recipes);
export async function audit(
  actor: { id: string; name: string } | undefined,
  action: string,
  target: string,
  detail: string,
) {
  const event: AuditEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actorId: actor?.id || "system",
    actor: actor?.name || "System",
    action,
    target,
    detail,
  };
  await writeEntity(`audit:${event.id}`, event);
  return event;
}
export async function stockEvent(
  actor: { id: string; name: string } | undefined,
  productId: string,
  before: number,
  after: number,
  reason: string,
) {
  if (before === after) return;
  const event: StockEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actorId: actor?.id || "system",
    actor: actor?.name || "System",
    action: "stock",
    target: productId,
    detail: reason,
    productId,
    before,
    after,
    reason,
  };
  await writeEntity(`stock-event:${event.id}`, event);
}
