/**
 * Apply pending Neo4j schema migrations (constraints/indexes) to a production database.
 *
 * Usage:
 *   NEO4J_URI=<uri> NEO4J_USER=<user> NEO4J_PASSWORD=<password> pnpm --filter @workspace/db-neo4j migrate:prod
 *   # or pass an env file:
 *   pnpm --filter @workspace/db-neo4j migrate:prod /tmp/vercel-prod.env
 *
 * Reads NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD from the environment or from the
 * .env file passed as the first argument. Runs all pending migrations from
 * packages/db-neo4j/src/schema/migrations/ and exits.
 */

import { readFileSync, existsSync } from "fs";

// ── 1. Load env file if provided ────────────────────────────────────────────

const envFile = process.argv[2];
if (envFile) {
  if (!existsSync(envFile)) {
    console.error(`Env file not found: ${envFile}`);
    process.exit(1);
  }
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

if (!process.env["NEO4J_URI"]) {
  console.error("Missing NEO4J_URI. Pass an env file as argument or set the variable.");
  process.exit(1);
}

// ── 2. Run migrations ─────────────────────────────────────────────────────────

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
