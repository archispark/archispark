/**
 * Run the idempotent Organization backfill against a production PostgreSQL
 * database. Companion to migrate-prod.ts: `migrate:prod` only applies DDL
 * (packages/db/drizzle-pg/*.sql) — this populates workspaces.organization_id
 * / api_tokens.organization_id, which the DDL alone leaves NULL. Required
 * after every `migrate:prod` run that includes 0018_organizations_expand.sql
 * or later (no-op on a fresh database, and safe to re-run).
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm --filter @workspace/db backfill:prod
 *   # or pass an env file:
 *   pnpm --filter @workspace/db backfill:prod /tmp/vercel-prod.env
 *
 * With no argument, loads `.env` from the repo root when present. Vars
 * already set in the environment always take priority.
 */

import { existsSync } from "fs"
import { applyEnvFile, loadEnv } from "@workspace/env"

// ── 1. Load env file — explicit arg, or the repo root `.env` if present ────

const envFile = process.argv[2]
if (envFile) {
  if (!existsSync(envFile)) {
    console.error(`Env file not found: ${envFile}`)
    process.exit(1)
  }
  applyEnvFile(envFile)
} else {
  loadEnv()
}

if (!process.env["DATABASE_URL"]) {
  console.error(
    "Missing DATABASE_URL. Pass an env file as argument or set the variable."
  )
  process.exit(1)
}

// Relative import (not the "@workspace/db" package specifier): its dist/
// build may be stale/absent when this script runs standalone via tsx, and
// connection.ts reads DATABASE_URL at module-init time, so the import must
// happen after the env file is loaded above.
const { runOrganizationBackfill } =
  await import("../src/backfill-organizations.js")

console.log("Running organization backfill...")
try {
  await runOrganizationBackfill()
  console.log("✓ Backfill complete.")
  process.exit(0)
} catch (err) {
  console.error("✗ Backfill failed:", err)
  process.exit(1)
}
