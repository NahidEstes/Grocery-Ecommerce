import fs from "node:fs/promises";
import path from "node:path";
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8")),
  inventory = [];
await fs.mkdir("docs/third-party-licenses", { recursive: true });
for (const [location, locked] of Object.entries(lock.packages)) {
  if (!location) continue;
  let installed;
  try {
    installed = JSON.parse(
      await fs.readFile(path.join(location, "package.json"), "utf8"),
    );
  } catch {}
  const name = installed?.name || location.split("node_modules/").at(-1),
    id = location.replace(/[^a-z0-9.-]/gi, "_");
  const notices = [];
  if (installed)
    for (const file of await fs.readdir(location))
      if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(file)) {
        const source = path.join(location, file);
        if (!(await fs.stat(source)).isFile()) continue;
        const target = `docs/third-party-licenses/${id}-${file}`;
        await fs.copyFile(source, target);
        notices.push(target);
      }
  inventory.push({
    name,
    version: installed?.version || locked.version,
    license:
      installed?.license || locked.license || "UNRESOLVED: inspect upstream",
    development: !!locked.dev,
    installed: !!installed,
    notices,
  });
}
await fs.writeFile(
  "docs/dependency-inventory.json",
  JSON.stringify(inventory, null, 2) + "\n",
);
console.log(
  `${inventory.length} lockfile entries inventoried; ${inventory.filter((p) => String(p.license).startsWith("UNRESOLVED")).length} license identifiers unresolved.`,
);
