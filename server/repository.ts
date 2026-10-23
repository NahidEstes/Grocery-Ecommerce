import mongoose from "mongoose";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  open,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);
const Entity =
  mongoose.models.StoreEntity || mongoose.model("StoreEntity", schema);
type Snapshot = Record<string, unknown>;
const context = new AsyncLocalStorage<{
  snapshot?: Snapshot;
  dirty?: boolean;
  session?: mongoose.ClientSession;
}>();
export const dataDirectory = () =>
  process.env.FRESHCART_DATA_DIR || join(process.cwd(), ".data");
const file = () => join(dataDirectory(), "store.json");
export const mongo = () => mongoose.connection.readyState === 1;
async function snapshot(): Promise<Snapshot> {
  try {
    return JSON.parse(await readFile(file(), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
export async function readEntity<T>(key: string): Promise<T | null> {
  if (mongo()) {
    const doc = await Entity.findOne({ key })
      .session(context.getStore()?.session || null)
      .lean();
    return doc ? (structuredClone(doc.value) as T) : null;
  }
  const data = context.getStore()?.snapshot || (await snapshot());
  return data[key] === undefined ? null : (structuredClone(data[key]) as T);
}
export async function listEntities<T>(prefix: string): Promise<T[]> {
  if (mongo()) {
    const docs = await Entity.find({
      key: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
    })
      .session(context.getStore()?.session || null)
      .lean();
    return docs.map((d) => structuredClone(d.value) as T);
  }
  const data = context.getStore()?.snapshot || (await snapshot());
  return Object.entries(data)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, v]) => structuredClone(v) as T);
}
export async function writeEntity<T>(key: string, value: T) {
  if (mongo()) {
    await Entity.updateOne(
      { key },
      { $set: { value } },
      { upsert: true, session: context.getStore()?.session },
    );
    return;
  }
  if (context.getStore()?.snapshot) {
    context.getStore()!.dirty = true;
    context.getStore()!.snapshot![key] = structuredClone(value);
    return;
  }
  await atomic(() => writeEntity(key, value));
}
export async function deleteEntity(key: string) {
  if (mongo()) {
    await Entity.deleteOne({ key }).session(
      context.getStore()?.session || null,
    );
    return;
  }
  if (context.getStore()?.snapshot) {
    context.getStore()!.dirty = true;
    delete context.getStore()!.snapshot![key];
    return;
  }
  await atomic(() => deleteEntity(key));
}
let queue: Promise<unknown> = Promise.resolve();
async function fileLock() {
  await mkdir(dataDirectory(), { recursive: true });
  const path = join(dataDirectory(), "store.lock");
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      const handle = await open(path, "wx", 0o600);
      await handle.writeFile(String(process.pid));
      return async () => {
        await handle.close();
        await unlink(path).catch(() => {});
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const pid = Number(await readFile(path, "utf8"));
        if (pid > 0)
          try {
            process.kill(pid, 0);
          } catch (probe) {
            if ((probe as NodeJS.ErrnoException).code === "ESRCH")
              await unlink(path).catch(() => {});
          }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("The local store is busy. Please retry.");
}
export async function atomic<T>(operation: () => Promise<T>): Promise<T> {
  if (context.getStore()) return operation();
  const run = queue.then(async () => {
    if (mongo())
      return mongoose.connection.transaction(async (session) =>
        context.run({ session }, operation),
      );
    const release = await fileLock();
    try {
      const data = await snapshot();
      const transaction = { snapshot: data, dirty: false };
      const result = await context.run(transaction, operation);
      if (!transaction.dirty) return result;
      await mkdir(dataDirectory(), { recursive: true });
      const temp = `${file()}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, JSON.stringify(data), {
          mode: 0o600,
          flag: "wx",
        });
        for (let attempt = 0; ; attempt++) {
          try {
            await rename(temp, file());
            break;
          } catch (error) {
            if (
              attempt >= 7 ||
              !["EPERM", "EBUSY", "EACCES"].includes(
                (error as NodeJS.ErrnoException).code || "",
              )
            )
              throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(500, 25 * 2 ** attempt)),
            );
          }
        }
      } finally {
        await unlink(temp).catch(() => {});
      }
      return result;
    } finally {
      await release();
    }
  });
  queue = run.catch(() => {});
  return run;
}
export async function initializeRepository() {
  if (mongo()) await Entity.init();
}
