# Changelog

All notable changes to this project will be documented in this file.

---

## Unreleased

---

## 0.5.1 — 2026-06-04

### Added

- **ArchiMate 3.1 semantic layer for the MCP server.** A new `archimate-guide.ts` module centralises all semantic knowledge: element types grouped by layer and category (active/behavioural/passive), relationship semantics with direction and concrete examples, post-mutation hints, and guided error messages grouped by ArchiMate layer.
- **MCP Prompts.** Two prompts are now registered on the MCP server: `archimate-modeling-guide` (injects the full ArchiMate 3.1 rules, layer structure, relationship semantics and recommended workflow) and `create-viewpoint-view` (step-by-step guide for creating a view for a specific viewpoint, with a `viewpoint` argument).
- **MCP Resources.** Two static resources are exposed: `archimate://layers` (JSON of all 8 layers with element types by category) and `archimate://relationships` (JSON of all 11 relationship types with semantics, direction and examples). The LLM can read them on demand without polluting every tool response.
- **Layered `list_element_types` output.** The tool now returns elements grouped by layer and category (active/behavioural/passive), with both the types present in the current model and the full ArchiMate 3.1 type list per category.
- **Enriched `list_relationship_types` output.** Each relationship type now includes a `description` and `direction` field.
- **Post-mutation hints.** `create_element` returns a `hints` object with the element's ArchiMate layer and layer-specific next steps. `create_relationship` returns the semantic description, direction and suggested next steps. `create_view` returns a `next_steps` array guiding toward `create_node` → `create_connection` → `render_view`.
- **Guided error messages.** Type validation errors now list valid ArchiMate types grouped by layer (instead of a flat alphabetical dump), with a hint to call `list_element_types`.
- **MCP server description.** `McpServer` now includes a `description` field explaining the ArchiMate 3.1 context and recommending the `archimate-modeling-guide` prompt.
- **GitHub Actions auto-assign workflow.** New `.github/workflows/auto-assign.yml` automatically assigns opened issues and PRs.

### Fixed

- **Broken CI/CD GitHub Actions versions.** The `chore: update packages` commit had re-introduced non-existent action versions (`actions/checkout@v6`, `pnpm/action-setup@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`) that had previously been fixed in commit `8aa9778`. All four actions are restored to their current stable `@v4`.
- **`@vitest/coverage-v8` version mismatch.** `apps/mcp-server` and `packages/db` had `@vitest/coverage-v8` pinned at `^4.1.7` while `vitest` was bumped to `^4.1.8`. Both are now consistently at `^4.1.8`.

### Changed

- **Tool descriptions rewritten as micro-instructions.** All 38 MCP tool descriptions now embed ArchiMate semantic guidance (correct layer, category, relationship direction) rather than being simple one-line labels. The LLM receives this context at every tool call.
- **Dependency bumps.** `better-auth` 1.6.14, `react`/`react-dom` 19.2.7, `next` 16.2.7, `@xyflow/react` 12.11.0, `vitest` 4.1.8, `tsx` 4.22.4, `vite` 8.0.16, `prettier-plugin-tailwindcss` 0.8.0.

### Added

- **14 new MCP tools — full API parity.** The MCP server now exposes 38 tools (up from 24), covering all ArchiMate modeling operations: `update_view`, `delete_view`, `update_node`, `delete_node`, `create_connection`, `update_connection`, `delete_connection`, `get_element_relationships`, `list_elements_in_views`, `list_workspaces`, `activate_workspace`, `export_model`, `import_model`, `list_viewpoints`. An AI agent can now build, populate, and fully refactor views without leaving the MCP context.
- **Settings tab order.** Tabs in the Settings page are now ordered: Général — Membres — Rôles — Authentification — MCP — Redis — Import/Export.
- **MCP Bearer token authentication.** The MCP server now enforces a `Bearer` token when `MCP_AUTH_TOKEN` is set. The token is generated and displayed in **Settings → MCP** (new tab), with a masked display, copy button, and the ready-to-run `claude mcp add` command. The token is stored in the `mcp_tokens` table (migration `0002_mcp_tokens.sql`) and verified server-side on every request.
- **Vercel Analytics and Speed Insights.** `@vercel/analytics` and `@vercel/speed-insights` are now included in the Next.js layout. Both are no-ops outside Vercel deployments.
- **Settings → MCP tab.** Dedicated tab in the settings page for MCP token management (generate, regenerate, reveal, copy).
- **ArchiMate type icons on the view canvas.** Every element on the web view canvas now shows its ArchiMate notation icon in the top-right corner (business process arrow, application component, node, gear/equipment, target/goal, etc.). The glyphs are extracted from Archi's own reference SVG exports (`models/exports/references/`) for fidelity, with hand-crafted standard notation for the few element types whose exports lacked a corner glyph (collaboration, interaction, role, contract, …). See `apps/web/components/archimate-icons.ts`.
- **ArchiMate type icons in the server SVG export.** `renderViewToSvg` now draws the same corner type-icons as inline vectors for box-mode elements (replacing the never-populated PNG icon loader, which left server exports icon-less). The icon data is duplicated to `apps/api/src/archimate-icons.ts` (kept in sync with the web copy).
- **Canvas image download menu.** A single "Télécharger ▾" button in the canvas toolbar opens a menu to export the view as **PNG or SVG** (client-side via `html-to-image`'s `toPng`/`toSvg`).

### Fixed

- **MCP server runtime crash on Vercel (`ERR_MODULE_NOT_FOUND`, HTTP 500).** `apps/mcp-server` had no serverless entry or `vercel.json`, so the API workspace's `dist/` was never built during its deploy and its `api/src/*.js` imports (which resolve to `api/dist/*.js` at runtime via the package `exports` map) couldn't be found. Added `apps/mcp-server/api/index.ts` (exports the compiled Express app) and `apps/mcp-server/vercel.json` (builds `@workspace/db` + `api` + `mcp-server`, with a catch-all rewrite to `/api/index`), mirroring the working `apps/api` setup. The vercel.json also sets `"framework": null` — Vercel had auto-detected the project as `express`, which bypassed the `api/` convention and rewrites and kept it crashing with `ERR_MODULE_NOT_FOUND`.
- **MCP server build on Vercel (`TS2322` on `PropertyOut[]`).** `apps/mcp-server` pinned Zod v3 while `apps/api` (and the MCP SDK) use Zod v4, so a fresh install deduped a mixed Zod tree and the SDK inferred tool-handler property fields as optional, breaking the `tsc` build. Aligned `mcp-server` to `zod@^4.4.3` (matching the rest of the monorepo) so the whole tree resolves a single Zod version.
- **Nested element positioning on the view canvas.** Child elements are now placed correctly inside their parent. The model stores absolute coordinates, but React Flow positions children relative to their parent, so nested nodes were double-offset by the parent's position. Coordinates are converted to parent-relative when building the canvas (and back to absolute when a node is dragged).
- **Crash on the theme hotkey.** `ThemeHotkey` no longer throws `Cannot read properties of undefined (reading 'toLowerCase')` for keyboard events without a `key` (IME composition, autofill).

### Changed

- **The API is now stateless — PostgreSQL is the single source of truth.** Removed the in-memory ArchiMate model (`dataSource`) and the full-workspace "auto-save on every write". Each request reads/writes Postgres at row level through a new `apps/api/src/store.ts`, so any instance can serve any request and concurrent edits to different rows no longer clobber each other (it is now safe to run multiple API replicas). The active workspace is persisted as `workspaces.is_active` (shared across instances) instead of being process-global state. `POST /save` is now a no-op (writes are already persisted). Render/export load the model on demand via `modelFromDb`.
- **Database is now PostgreSQL-only.** Removed the SQLite (`better-sqlite3`) driver, the dual-driver switch (`DB_DRIVER`), the parallel `schema-pg.ts`, and the SQLite migrations. `packages/db` exposes a single Postgres schema and `drizzle-pg/` migrations. The connection string comes from `DATABASE_URL` (with `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL` fallbacks for the Supabase/Vercel integration).
- The test suite now runs on [PGlite](https://pglite.dev) (in-memory WASM Postgres) instead of in-memory SQLite — full Postgres fidelity, no Docker. Auto-selected when `VITEST` is set (or `DB_CLIENT=pglite`).
- Added the missing `oauth_providers` table to the Postgres schema/migrations (it previously existed only for SQLite, breaking OAuth-provider CRUD on Postgres).

### Changed

- **Redis is now mandatory.** `REDIS_URL` is required at startup — the API throws if it is absent. Redis is used for Better Auth's session store and distributed rate-limiting (`rate-limit-redis`). The optional fallback paths (cookie-based session cache, in-memory rate-limiter) have been removed. The `docker-compose.redis.yml` overlay is no longer optional for production deployments.

### Removed

- **Redis optional fallback code.** `buildSecondaryStorage()`, the `cookieCache` conditional, and the `if (!redis)` guards in `redisStore()` and `/settings/redis` have been deleted. `getRedis()` now returns `Redis` (non-nullable) and throws if not initialised.
- **The "SVG" tab on the web view detail page.** The view is now shown only as the interactive canvas; the server-rendered SVG is still available to the API/MCP via `GET /views/:id/image?format=svg`, just no longer surfaced in the UI.
- **Server-side PNG export (`sharp`).** The `/views/:id/image?format=png` endpoint and the MCP `render_view` PNG option now serve/return SVG only. PNG export is handled client-side in the web UI (React Flow + `html-to-image`). This drops the native `sharp` dependency from the API, making it serverless/container friendly.

### History

- Extracted shared DB layer to `packages/db` (`@workspace/db`): ArchiMate model types, Drizzle schema, database connection, migrations, and model I/O now live in one package consumed by both `apps/api` and `apps/mcp-server`.
- `apps/mcp-server` now depends on `api` workspace package directly (replaces manual `mcp-archimate` symlink).
- Migration files moved from `apps/api/drizzle/` to `packages/db/drizzle-pg/` — run `cd packages/db && DB_DRIVER=postgres npx drizzle-kit generate` after schema changes.
- MCP server endpoint corrected to `http://localhost:3001/mcp/` (was documented as `:3000`).

---
