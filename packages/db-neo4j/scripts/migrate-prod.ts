/**
 * Apply pending Neo4j schema migrations (constraints/indexes) to a production database.
 *
 * Usage:
 *   NEO4J_URI=<uri> NEO4J_USER=<user> NEO4J_PASSWORD=<password> pnpm --filter @workspace/db-neo4j migrate:prod
 *   # or pass an env file:
 *   pnpm --filter @workspace/db-neo4j migrate:prod /tmp/vercel-prod.env
 *
 * Reads NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD from the environment, from the
 * .env file passed as the first argument, or from the repo root `.env` when
 * present and no argument is given (vars already set in the environment
 * always take priority). Skips cleanly when NEO4J_ENABLED=false. Runs all
 * pending migrations from packages/db-neo4j/src/schema/migrations/ and exits.
 */

import { existsSync } from "fs";
import { applyEnvFile, loadEnv } from "@workspace/env";
import { isNeo4jEnabled } from "../src/config.js";

// ── 1. Load env file — explicit arg, or the repo root `.env` if present ────

const envFile = process.argv[2];
if (envFile) {
  if (!existsSync(envFile)) {
    console.error(`Env file not found: ${envFile}`);
    process.exit(1);
  }
  applyEnvFile(envFile);
} else {
  loadEnv();
}

// ── 2. Skip cleanly if Neo4j is disabled ────────────────────────────────────

if (!isNeo4jEnabled()) {
  console.log("Neo4j désactivé (NEO4J_ENABLED=false) : migration ignorée.");
  process.exit(0);
}

if (!process.env["NEO4J_URI"]) {
  console.error("Missing NEO4J_URI. Pass an env file as argument or set the variable.");
  process.exit(1);
}

// ── 3. Run migrations ─────────────────────────────────────────────────────────

const { runNeo4jMigrations } = await import("../src/schema/migrate.js");
const { closeDriver } = await import("../src/connection.js");

console.log(`Connecting to Neo4j at ${process.env["NEO4J_URI"]}...`);
try {
  await runNeo4jMigrations();
  console.log("✓ Migrations applied successfully.");
} catch (err) {
  console.error("✗ Migration failed:", err);
  process.exit(1);
} finally {
  await closeDriver();
}
