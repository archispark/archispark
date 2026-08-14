/**
 * Import every workspace's ArchiMate model from PostgreSQL into Neo4j — same
 * per-workspace logic as import-workspace.ts, looped over all workspaces.
 * One workspace failing doesn't stop the others; failures are reported in
 * the summary and cause a non-zero exit.
 *
 * Usage:
 *   pnpm import:workspaces
 *   # or pass a specific env file for DATABASE_URL/NEO4J_*:
 *   pnpm import:workspaces .env.prod
 *
 * Requires:
 *   DATABASE_URL — source PostgreSQL database (the workspaces to read)
 *   NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD — target Neo4j instance
 *
 * With no argument, loads `.env` from the repo root when present, otherwise
 * `.env.$ENV` (`.env.dev` by default). Vars already set in the environment
 * still take priority.
 */

import { existsSync } from "fs"
import { isAbsolute, join, resolve } from "path"
import { applyEnvFile, repoRoot as envRepoRoot } from "@workspace/env"

// ── 1. Load env file — explicit arg, or .env.$ENV at the repo root if present ──

// Scripts always run with cwd = packages/db-neo4j (pnpm --filter), but
// .env.dev/.env.prod live at the repo root — resolve a relative path
// against the repo root rather than cwd, so `pnpm import:workspaces
// .env.dev` works whether invoked from the repo root or a package.
const repoRoot = envRepoRoot()
const envFileArg = process.argv.slice(2).find((a) => a !== "--")
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
    "Missing DATABASE_URL. Pass an env file as argument or set the variable."
  )
  process.exit(1)
}

// ── 2. Import every workspace ────────────────────────────────────────────────

// Dynamic import (not a static top-level import): @workspace/db reads
// DATABASE_URL at module-init time, so the import must happen after the env
// file is loaded above.
const { db, workspaces, organizations, modelFromDb } =
  await import("@workspace/db")
const { importModelToNeo4j } = await import("../src/import-model.js")
const { closeDriver } = await import("../src/connection.js")

const MAX_IMPORT_ATTEMPTS = 3

function isRetriableNeo4jFailure(error: unknown): boolean {
  if (error && typeof error === "object") {
    const candidate = error as { retriable?: unknown; retryable?: unknown }
    if (candidate.retriable === true || candidate.retryable === true)
      return true
  }
  return /ECONNRESET|SessionExpired|Failed to connect/i.test(
    error instanceof Error ? error.message : String(error)
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const allWorkspaces = await db.select().from(workspaces)
if (allWorkspaces.length === 0) {
  console.log("No workspace to import.")
  process.exit(0)
}

const orgById = new Map(
  (await db.select().from(organizations)).map((org) => [org.id, org])
)

console.log(`Importing ${allWorkspaces.length} workspace(s) into Neo4j...`)

let failures = 0
for (const ws of allWorkspaces) {
  console.log(`\n"${ws.name}" (${ws.uuid})`)
  const org =
    ws.organizationId === null ? undefined : orgById.get(ws.organizationId)
  if (!org) {
    failures++
    console.error(
      `✗ Import failed: aucune organisation associée à ce workspace.`
    )
    continue
  }
  try {
    const model = await modelFromDb(ws.id)
    let result: Awaited<ReturnType<typeof importModelToNeo4j>>
    for (let attempt = 1; ; attempt++) {
      try {
        result = await importModelToNeo4j(model, org)
        break
      } catch (err) {
        if (!isRetriableNeo4jFailure(err) || attempt === MAX_IMPORT_ATTEMPTS) {
          throw err
        }
        const delayMs = attempt * 1_000
        console.warn(
          `Neo4j connection failed (attempt ${attempt}/${MAX_IMPORT_ATTEMPTS}); retrying in ${delayMs}ms...`
        )
        await closeDriver()
        await wait(delayMs)
      }
    }
    console.log(`✓ ${JSON.stringify(result)}`)
  } catch (err) {
    failures++
    console.error(`✗ Import failed:`, err)
  }
}

console.log(
  `\n${allWorkspaces.length - failures}/${allWorkspaces.length} workspace(s) imported successfully.`
)
// The shared @workspace/db Pool and the Neo4j driver both keep the event
// loop alive with no clean way to close them from here — force exit rather
// than hang, same convention as packages/db/scripts/backfill-prod.ts.
process.exit(failures > 0 ? 1 : 0)
