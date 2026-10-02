/**
 * Wire sample packs into sibling auto_mcp_ai core (dev tree).
 * Add entries here when scaffolding packages/site-adapter-<name>/.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {{ npmName: string; importName: string; exportId: string }[]} */
const WIRED_SAMPLES = [
  {
    npmName: "@auto-mcp/site-adapter-jira",
    importName: "jiraAdapter",
    exportId: "jiraAdapter",
  },
];

const sampleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreRoot =
  process.env.CORE_ROOT?.trim() || resolve(sampleRoot, "..", "auto_mcp_ai");

const target = resolve(
  coreRoot,
  "packages/site-adapters/src/adapters.extra.ts",
);

if (!existsSync(resolve(coreRoot, "package.json"))) {
  console.error(`Core not found: ${coreRoot}`);
  process.exit(1);
}

const importLines = WIRED_SAMPLES.map(
  (s) => `import { ${s.importName} } from "${s.npmName}";`,
).join("\n");
const arrayItems = WIRED_SAMPLES.map((s) => s.exportId).join(", ");

const content = `/**
 * Wired by auto_mcp_ai_sample_packs/scripts/wire-sample-core.mjs
 * Do not commit populated file to public auto_mcp_ai remote.
 */
import type { SiteAdapter } from "./types.js";
${importLines}

export const extraAdapters: SiteAdapter[] = [${arrayItems}];
`;

writeFileSync(target, content, "utf8");
console.log(`Wrote ${target}`);

const siteAdaptersPkgPath = resolve(
  coreRoot,
  "packages/site-adapters/package.json",
);
const siteAdaptersPkg = JSON.parse(readFileSync(siteAdaptersPkgPath, "utf8"));
siteAdaptersPkg.devDependencies ??= {};
let patched = false;
for (const { npmName } of WIRED_SAMPLES) {
  if (!siteAdaptersPkg.devDependencies[npmName]) {
    siteAdaptersPkg.devDependencies[npmName] = "workspace:*";
    patched = true;
    console.log(`Added devDependency ${npmName} to site-adapters`);
  }
}
if (patched) {
  writeFileSync(
    siteAdaptersPkgPath,
    `${JSON.stringify(siteAdaptersPkg, null, 2)}\n`,
    "utf8",
  );
}

console.log(
  "Next: pnpm install from dev tree root, then pnpm run build:wired.",
);
