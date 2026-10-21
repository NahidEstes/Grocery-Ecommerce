import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUser } from "./auth";
import { atomic, listEntities, readEntity, writeEntity } from "./repository";
import { getCatalog, listOrders } from "./store";
import { bad } from "./validation";
import {
  regularPurchases,
  activeOrder,
  type ShoppingListRecord,
  type ShoppingList,
  type ShoppingListEntry,
} from "../src/lib/shopping";

export const shoppingRoutes = Router();
const listInput = z.object({
  name: z.string().trim().min(2).max(60),
  notes: z.string().trim().max(200).default(""),
  items: z
    .array(
      z.object({
        productId: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(60),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .max(50),
});
const publicList = ({
  userId: _owner,
  ...list
}: ShoppingListRecord): ShoppingList => list;
async function ownedList(id: string, userId: string) {
  const list = await readEntity<ShoppingListRecord>(`shopping-list:${id}`);
  if (!list || list.userId !== userId)
    throw bad("Shopping list not found.", 404);
  return list;
}
async function entries(
  input: z.infer<typeof listInput>["items"],
  previous: ShoppingListEntry[] = [],
) {
  const catalog = await getCatalog();
  const quantities = new Map<string, number>();
  for (const i of input)
    quantities.set(
      i.productId,
      (quantities.get(i.productId) || 0) + i.quantity,
    );
  return [...quantities].map(([productId, quantity]) => {
    if (quantity > 100)
      throw bad("Each product can have at most 100 packs on a list.");
    const p = catalog.find((p) => p.id === productId);
    const old = previous.find((i) => i.productId === productId);
    if ((!p || p.active === false) && !old)
      throw bad(
        "A selected product is no longer available. Refresh and choose another product.",
      );
    return {
      productId,
      quantity,
      name: p?.name || old!.name,
      unit: p?.unit || old!.unit,
    };
  });
}
shoppingRoutes.get("/me/shopping", async (req, res) => {
  const user = await requireUser(req);
  const orders = await listOrders();
  const lists = (await listEntities<ShoppingListRecord>("shopping-list:"))
    .filter((l) => l.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(publicList);
  res.json({
    regular: regularPurchases(orders, user.id),
    activeOrder: activeOrder(orders, user.id),
    lists,
  });
});
shoppingRoutes.post("/me/lists", async (req, res) => {
  const user = await requireUser(req);
  const input = listInput.parse(req.body);
  const list = await atomic(async () => {
    if (
      (await listEntities<ShoppingListRecord>("shopping-list:")).filter(
        (l) => l.userId === user.id && !l.archived,
      ).length >= 20
    )
      throw bad(
        "You can keep 20 active lists. Archive a list to create another.",
        409,
      );
    const now = new Date().toISOString();
    const list: ShoppingListRecord = {
      ...input,
      items: await entries(input.items),
      id: randomUUID(),
      userId: user.id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    await writeEntity(`shopping-list:${list.id}`, list);
    return list;
  });
  res.status(201).json({ list: publicList(list) });
});
shoppingRoutes.put("/me/lists/:id", async (req, res) => {
  const user = await requireUser(req);
  const input = listInput
    .extend({ version: z.number().int().positive() })
    .parse(req.body);
  const list = await atomic(async () => {
    const old = await ownedList(req.params.id as string, user.id);
    if (old.archived) throw bad("Restore this list before editing it.", 409);
    if (old.version !== input.version)
      throw bad(
        "This list changed on another device. Refresh before editing.",
        409,
      );
    const list = {
      ...old,
      name: input.name,
      notes: input.notes,
      items: await entries(input.items, old.items),
      version: old.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await writeEntity(`shopping-list:${list.id}`, list);
    return list;
  });
  res.json({ list: publicList(list) });
});
shoppingRoutes.patch("/me/lists/:id/archive", async (req, res) => {
  const user = await requireUser(req);
  const input = z
    .object({ archived: z.boolean(), version: z.number().int().positive() })
    .parse(req.body);
  const list = await atomic(async () => {
    const old = await ownedList(req.params.id as string, user.id);
    if (old.version !== input.version)
      throw bad("This list changed. Refresh before updating it.", 409);
    if (
      !input.archived &&
      old.archived &&
      (await listEntities<ShoppingListRecord>("shopping-list:")).filter(
        (l) => l.userId === user.id && !l.archived,
      ).length >= 20
    )
      throw bad("Archive another active list before restoring this one.", 409);
    const list = {
      ...old,
      archived: input.archived,
      version: old.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await writeEntity(`shopping-list:${list.id}`, list);
    return list;
  });
  res.json({ list: publicList(list) });
});
