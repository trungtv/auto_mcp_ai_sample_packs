/**
 * Writes adapters.extra.ts on sibling auto_mcp_ai core (dev tree).
 * CORE_ROOT default: ../auto_mcp_ai
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreRoot =
  process.env.CORE_ROOT?.trim() || resolve(packRoot, "..", "auto_mcp_ai");

const target = resolve(
  coreRoot,
  "packages/site-adapters/src/adapters.extra.ts",
);

if (!existsSync(resolve(coreRoot, "package.json"))) {
  console.error(`Core not found: ${coreRoot}`);
  process.exit(1);
}

const content = `/**
 * Wired by auto_mcp_ai_pack_jira/scripts/wire-core.mjs
 * @see https://github.com/YOU/auto_mcp_ai_pack_jira
 */
import type { SiteAdapter } from "./types.js";
import { jiraAdapter } from "@auto-mcp/site-adapter-jira";

export const extraAdapters: SiteAdapter[] = [jiraAdapter];
`;

writeFileSync(target, content, "utf8");
console.log(`Wrote ${target}`);

const siteAdaptersPkgPath = resolve(
  coreRoot,
  "packages/site-adapters/package.json",
);
const siteAdaptersPkg = JSON.parse(readFileSync(siteAdaptersPkgPath, "utf8"));
siteAdaptersPkg.devDependencies ??= {};
if (!siteAdaptersPkg.devDependencies["@auto-mcp/site-adapter-jira"]) {
  siteAdaptersPkg.devDependencies["@auto-mcp/site-adapter-jira"] =
    "workspace:*";
  writeFileSync(
    siteAdaptersPkgPath,
    `${JSON.stringify(siteAdaptersPkg, null, 2)}\n`,
    "utf8",
  );
  console.log(`Added devDependency @auto-mcp/site-adapter-jira to site-adapters`);
}

console.log(
  "Next: pnpm install from dev tree root, then pnpm --dir auto_mcp_ai build.",
);
