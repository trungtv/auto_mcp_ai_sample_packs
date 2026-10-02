# auto_mcp_ai_pack_jira (public example)

Site pack **Jira Cloud** for [auto_mcp_ai](https://github.com/trungtv/auto_mcp_ai) — cùng pattern với `@entrade/site-adapter-*` trong repo private.

Package npm: **`@auto-mcp/site-adapter-jira`**

## Dev tree

```
<workspace>/
  auto_mcp_ai/              # core (git public)
  auto_mcp_ai_pack_jira/    # repo này
  auto_mcp_ai_packs/        # optional — Entrade private
```

## Setup

```bash
git clone <auto_mcp_ai> auto_mcp_ai
git clone <auto_mcp_ai_pack_jira> auto_mcp_ai_pack_jira
cd <workspace> && pnpm install   # nếu có pnpm-workspace ở folder cha
cd auto_mcp_ai_pack_jira && pnpm wire:core
pnpm --dir auto_mcp_ai build
```

## Copy pattern cho pack mới

1. Fork/copy repo này hoặc `site-adapter-jira` → đổi `match`, formatters, package name.
2. Thêm import trong `core/packages/site-adapters/src/adapters.extra.ts`.
3. Pin `@auto-mcp/*` từ tag/release core.
