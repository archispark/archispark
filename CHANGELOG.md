# Changelog

All notable changes to this project will be documented in this file.

---

## Unreleased

### Added

- **ArchiMate type icons on the view canvas.** Every element on the web view canvas now shows its ArchiMate notation icon in the top-right corner (business process arrow, application component, node, gear/equipment, target/goal, etc.). The glyphs are extracted from Archi's own reference SVG exports (`models/exports/references/`) for fidelity, with hand-crafted standard notation for the few element types whose exports lacked a corner glyph (collaboration, interaction, role, contract, …). See `apps/web/components/archimate-icons.ts`.
- **ArchiMate type icons in the server SVG export.** `renderViewToSvg` now draws the same corner type-icons as inline vectors for box-mode elements (replacing the never-populated PNG icon loader, which left server exports icon-less). The icon data is duplicated to `apps/api/src/archimate-icons.ts` (kept in sync with the web copy).
- **Canvas image download menu.** A single "Télécharger ▾" button in the canvas toolbar opens a menu to export the view as **PNG or SVG** (client-side via `html-to-image`'s `toPng`/`toSvg`).

### Fixed

- **MCP server build on Vercel (`TS2322` on `PropertyOut[]`).** `apps/mcp-server` pinned Zod v3 while `apps/api` (and the MCP SDK) use Zod v4, so a fresh install deduped a mixed Zod tree and the SDK inferred tool-handler property fields as optional, breaking the `tsc` build. Aligned `mcp-server` to `zod@^4.4.3` (matching the rest of the monorepo) so the whole tree resolves a single Zod version.
- **Nested element positioning on the view canvas.** Child elements are now placed correctly inside their parent. The model stores absolute coordinates, but React Flow positions children relative to their parent, so nested nodes were double-offset by the parent's position. Coordinates are converted to parent-relative when building the canvas (and back to absolute when a node is dragged).
- **Crash on the theme hotkey.** `ThemeHotkey` no longer throws `Cannot read properties of undefined (reading 'toLowerCase')` for keyboard events without a `key` (IME composition, autofill).

### Changed

- **The API is now stateless — PostgreSQL is the single source of truth.** Removed the in-memory ArchiMate model (`dataSource`) and the full-workspace "auto-save on every write". Each request reads/writes Postgres at row level through a new `apps/api/src/store.ts`, so any instance can serve any request and concurrent edits to different rows no longer clobber each other (it is now safe to run multiple API replicas). The active workspace is persisted as `workspaces.is_active` (shared across instances) instead of being process-global state. `POST /save` is now a no-op (writes are already persisted). Render/export load the model on demand via `modelFromDb`.
- **Database is now PostgreSQL-only.** Removed the SQLite (`better-sqlite3`) driver, the dual-driver switch (`DB_DRIVER`), the parallel `schema-pg.ts`, and the SQLite migrations. `packages/db` exposes a single Postgres schema and `drizzle-pg/` migrations. The connection string comes from `DATABASE_URL` (with `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL` fallbacks for the Supabase/Vercel integration).
- The test suite now runs on [PGlite](https://pglite.dev) (in-memory WASM Postgres) instead of in-memory SQLite — full Postgres fidelity, no Docker. Auto-selected when `VITEST` is set (or `DB_CLIENT=pglite`).
- Added the missing `oauth_providers` table to the Postgres schema/migrations (it previously existed only for SQLite, breaking OAuth-provider CRUD on Postgres).

### Removed

- **The "SVG" tab on the web view detail page.** The view is now shown only as the interactive canvas; the server-rendered SVG is still available to the API/MCP via `GET /views/:id/image?format=svg`, just no longer surfaced in the UI.
- **Server-side PNG export (`sharp`).** The `/views/:id/image?format=png` endpoint and the MCP `render_view` PNG option now serve/return SVG only. PNG export is handled client-side in the web UI (React Flow + `html-to-image`). This drops the native `sharp` dependency from the API, making it serverless/container friendly.

### History

- Extracted shared DB layer to `packages/db` (`@workspace/db`): ArchiMate model types, Drizzle schema, database connection, migrations, and model I/O now live in one package consumed by both `apps/api` and `apps/mcp-server`.
- `apps/mcp-server` now depends on `api` workspace package directly (replaces manual `mcp-archimate` symlink).
- Migration files moved from `apps/api/drizzle/` to `packages/db/drizzle-pg/` — run `cd packages/db && DB_DRIVER=postgres npx drizzle-kit generate` after schema changes.
- MCP server endpoint corrected to `http://localhost:3001/mcp/` (was documented as `:3000`).

---
