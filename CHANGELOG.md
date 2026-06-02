# Changelog

All notable changes to this project will be documented in this file.

---

## Unreleased

### Changed

- **The API is now stateless — PostgreSQL is the single source of truth.** Removed the in-memory ArchiMate model (`dataSource`) and the full-workspace "auto-save on every write". Each request reads/writes Postgres at row level through a new `apps/api/src/store.ts`, so any instance can serve any request and concurrent edits to different rows no longer clobber each other (it is now safe to run multiple API replicas). The active workspace is persisted as `workspaces.is_active` (shared across instances) instead of being process-global state. `POST /save` is now a no-op (writes are already persisted). Render/export load the model on demand via `modelFromDb`.
- **Database is now PostgreSQL-only.** Removed the SQLite (`better-sqlite3`) driver, the dual-driver switch (`DB_DRIVER`), the parallel `schema-pg.ts`, and the SQLite migrations. `packages/db` exposes a single Postgres schema and `drizzle-pg/` migrations. The connection string comes from `DATABASE_URL` (with `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL` fallbacks for the Supabase/Vercel integration).
- The test suite now runs on [PGlite](https://pglite.dev) (in-memory WASM Postgres) instead of in-memory SQLite — full Postgres fidelity, no Docker. Auto-selected when `VITEST` is set (or `DB_CLIENT=pglite`).
- Added the missing `oauth_providers` table to the Postgres schema/migrations (it previously existed only for SQLite, breaking OAuth-provider CRUD on Postgres).

### Removed

- **Server-side PNG export (`sharp`).** The `/views/:id/image?format=png` endpoint and the MCP `render_view` PNG option now serve/return SVG only. PNG export is handled client-side in the web UI (React Flow + `html-to-image`). This drops the native `sharp` dependency from the API, making it serverless/container friendly.

### History

- Extracted shared DB layer to `packages/db` (`@workspace/db`): ArchiMate model types, Drizzle schema, database connection, migrations, and model I/O now live in one package consumed by both `apps/api` and `apps/mcp-server`.
- `apps/mcp-server` now depends on `api` workspace package directly (replaces manual `mcp-archimate` symlink).
- Migration files moved from `apps/api/drizzle/` to `packages/db/drizzle-pg/` — run `cd packages/db && DB_DRIVER=postgres npx drizzle-kit generate` after schema changes.
- MCP server endpoint corrected to `http://localhost:3001/mcp/` (was documented as `:3000`).

---
