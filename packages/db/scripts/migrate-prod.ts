/**
 * Apply pending Drizzle migrations to a production PostgreSQL database.
 *
 * Usage:
 *   POSTGRES_URL=<url> pnpm --filter @workspace/db migrate:prod
 *   # or pass an env file:
 *   pnpm --filter @workspace/db migrate:prod /tmp/vercel-prod.env
 *
 * Reads POSTGRES_URL (or DATABASE_URL) from the environment or from the .env
 * file passed as the first argument. Runs all pending migrations from
 * packages/db/drizzle-pg/ and exits.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

// ── 2. Resolve connection string ─────────────────────────────────────────────

const rawUrl =
  process.env["DATABASE_URL"] ??
  process.env["POSTGRES_URL"] ??
  process.env["POSTGRES_URL_NON_POOLING"];

if (!rawUrl) {
  console.error("Missing DATABASE_URL / POSTGRES_URL. Pass an env file as argument or set the variable.");
  process.exit(1);
}

function stripSslmode(cs: string): string {
  try {
    const u = new URL(cs);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return cs.replace(/([?&])sslmode=[^&]*/i, (_m, sep) => (sep === "?" ? "?" : "")).replace(/\?&/, "?").replace(/[?&]$/, "");
  }
}

const isLocal =
  /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(rawUrl) ||
  /[?&]sslmode=disable/i.test(rawUrl);

const connectionString = isLocal ? rawUrl : stripSslmode(rawUrl);
const ssl = isLocal ? undefined : { rejectUnauthorized: false };

// ── 3. Run migrations ─────────────────────────────────────────────────────────

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../drizzle-pg");

console.log(`Connecting to database...`);
const pool = new pg.Pool({ connectionString, ssl });
const db = drizzle(pool);

console.log(`Running migrations from: ${MIGRATIONS_FOLDER}`);
try {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("✓ Migrations applied successfully.");
} catch (err) {
  console.error("✗ Migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
