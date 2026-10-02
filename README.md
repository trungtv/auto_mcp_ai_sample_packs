# auto_mcp_ai_sample_packs (public)

Sample site adapters for [auto_mcp_ai](../auto_mcp_ai/) — same layout as private **`auto_mcp_ai_packs`**, but public and meant for demos + agent-authored packs.

| Package | Site |
|---------|------|
| `@auto-mcp/site-adapter-jira` | Jira Cloud (reference) |

Add new samples under **`packages/site-adapter-<name>/`**, register in `scripts/wire-sample-core.mjs` (`WIRED_SAMPLES`), then `pnpm wire:core`.

## Dev tree

```
<workspace>/
  auto_mcp_ai/                 # core (git public)
  auto_mcp_ai_sample_packs/    # this repo
  auto_mcp_ai_packs/           # optional — Entrade private
```

## Setup (Jira demo)

```bash
cd <workspace>
pnpm install
pnpm wire:sample              # folder cha — hoặc:
cd auto_mcp_ai_sample_packs && pnpm wire:core
pnpm install
pnpm run build:wired
```

**Do not push** populated `adapters.extra.ts` to the public core remote.

## Build / test

```bash
pnpm build
pnpm test
```
