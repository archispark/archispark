/**
 * Import one workspace's ArchiMate model from PostgreSQL into Neo4j — the
 * same logic as POST /api/export/neo4j, run from the command line instead
 * of through the HTTP API (no auth/session needed).
 *
 * Usage:
 *   pnpm import:workspace -- <workspace-uuid>
 *   # or pass a specific env file for DATABASE_URL/NEO4J_*:
 *   pnpm import:workspace -- <workspace-uuid> .env.prod
 *
 * Requires:
 *   DATABASE_URL — source PostgreSQL database (the workspace to read)
 *   NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD — target Neo4j instance
 *
 * With no env file argument, loads `.env` from the repo root when present,
 * otherwise `.env.$ENV` (`.env.dev` by default). Vars already set in the
 * environment still take priority.
 */

import { existsSync } from "fs"
import { isAbsolute, join, resolve } from "path"
import { applyEnvFile, repoRoot as envRepoRoot } from "@workspace/env"

// ── 1. Parse args, load env file — explicit arg, or .env.$ENV at the repo root if present ──

const args = process.argv.slice(2).filter((a) => a !== "--")
const workspaceUuid = args[0]
const envFileArg = args[1]
if (!workspaceUuid) {
  console.error("Usage: pnpm import:workspace -- <workspace-uuid> [envFile]")
  process.exit(1)
}

// Scripts always run with cwd = packages/db-neo4j (pnpm --filter), but
// .env.dev/.env.prod live at the repo root — resolve a relative path
// against the repo root rather than cwd, so `pnpm import:workspace --
// <uuid> .env.dev` works whether invoked from the repo root or a package.
const repoRoot = envRepoRoot()
const envFile = envFileArg
  ? isAbsolute(envFileArg)
    ? envFileArg
    : resolve(repoRoot, envFileArg)
  : existsSync(join(repoRoot, ".env"))
    ? join(repoRoot, ".env")
    : join(repoRoot, `.env.${process.env["ENV"] ?? "dev"}`)

if (envFileArg && !existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`)
  process.exit(1)
}
applyEnvFile(envFile)

if (!process.env["DATABASE_URL"]) {
  console.error(
    "Missing DATABASE_URL. Pass an env file as second argument or set the variable."
  )
  process.exit(1)
}

// ── 2. Import the workspace ─────────────────────────────────────────────────

// Dynamic import (not a static top-level import): @workspace/db reads
// DATABASE_URL at module-init time, so the import must happen after the env
// file is loaded above.
const { db, workspaces, organizations, modelFromDb } =
  await import("@workspace/db")
const { eq } = await import("drizzle-orm")
const { importModelToNeo4j } = await import("../src/import-model.js")

const [ws] = await db
  .select()
  .from(workspaces)
  .where(eq(workspaces.uuid, workspaceUuid))
if (!ws) {
  console.error(`Workspace '${workspaceUuid}' introuvable.`)
  process.exit(1)
}
if (ws.organizationId === null) {
  console.error(`Workspace '${workspaceUuid}' n'a pas d'organisation associée.`)
  process.exit(1)
}
const [org] = await db
  .select()
  .from(organizations)
  .where(eq(organizations.id, ws.organizationId))
if (!org) {
  console.error(`Organisation '${ws.organizationId}' introuvable.`)
  process.exit(1)
}

console.log(`Importing workspace "${ws.name}" (${workspaceUuid}) into Neo4j...`)
try {
  const model = await modelFromDb(ws.id)
  const result = await importModelToNeo4j(model, org)
  console.log(JSON.stringify(result, null, 2))
  // The shared @workspace/db Pool and the Neo4j driver both keep the event
  // loop alive with no clean way to close them from here — force exit
  // rather than hang, same convention as packages/db/scripts/backfill-prod.ts.
  process.exit(0)
} catch (err) {
  console.error("✗ Import failed:", err)
  process.exit(1)
}
