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
 * With no argument, loads `.env.$ENV` from the repo root (`.env.dev` by
 * default, same default as the root `pnpm env`/`pnpm up` scripts) if
 * present — vars already set in the environment still take priority.
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, isAbsolute, join, resolve } from "path";

// ── 1. Load env file — explicit arg, or .env.$ENV at the repo root if present ──

// Scripts always run with cwd = packages/db-neo4j (pnpm --filter), but
// .env.dev/.env.prod live at the repo root — resolve a relative path
// against the repo root rather than cwd, so `pnpm import:workspaces
// .env.dev` works whether invoked from the repo root or a package.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const envFileArg = process.argv.slice(2).find((a) => a !== "--");
const envFile = envFileArg
  ? isAbsolute(envFileArg)
    ? envFileArg
    : resolve(repoRoot, envFileArg)
  : join(repoRoot, `.env.${process.env["ENV"] ?? "dev"}`);

if (envFileArg && !existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  process.exit(1);
}
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawVal = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    // .env.dev/.env.prod interpolate other vars from the same file (e.g.
    // DATABASE_URL referencing DB_PASSWORD), same as docker-compose does —
    // resolve those against vars already loaded earlier in this file.
    const val = rawVal.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

if (!process.env["DATABASE_URL"]) {
  console.error("Missing DATABASE_URL. Pass an env file as argument or set the variable.");
  process.exit(1);
}

// ── 2. Import every workspace ────────────────────────────────────────────────

// Dynamic import (not a static top-level import): @workspace/db reads
// DATABASE_URL at module-init time, so the import must happen after the env
// file is loaded above.
const { db, workspaces, modelFromDb } = await import("@workspace/db");
const { importModelToNeo4j } = await import("../src/import-model.js");

const allWorkspaces = await db.select().from(workspaces);
if (allWorkspaces.length === 0) {
  console.log("No workspace to import.");
  process.exit(0);
}

console.log(`Importing ${allWorkspaces.length} workspace(s) into Neo4j...`);

let failures = 0;
for (const ws of allWorkspaces) {
  console.log(`\n"${ws.name}" (${ws.uuid})`);
  try {
    const model = await modelFromDb(ws.id);
    const result = await importModelToNeo4j(model);
    console.log(`✓ ${JSON.stringify(result)}`);
  } catch (err) {
    failures++;
    console.error(`✗ Import failed:`, err);
  }
}

console.log(`\n${allWorkspaces.length - failures}/${allWorkspaces.length} workspace(s) imported successfully.`);
// The shared @workspace/db Pool and the Neo4j driver both keep the event
// loop alive with no clean way to close them from here — force exit rather
// than hang, same convention as packages/db/scripts/backfill-prod.ts.
process.exit(failures > 0 ? 1 : 0);
