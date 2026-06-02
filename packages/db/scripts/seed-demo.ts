/**
 * Demo seed script — loads ArchiMetal + ArchiSurance workspaces into the DB.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Each workspace is skipped if one with the same name already exists (idempotent).
 * Requires DATABASE_URL (or POSTGRES_URL) to point to the target Postgres instance.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const SQL_PATH = resolve(import.meta.dirname, "../seeds/demo.sql");
const sql = readFileSync(SQL_PATH, "utf-8");

const connectionString =
  process.env["DATABASE_URL"] ??
  process.env["POSTGRES_URL"] ??
  process.env["POSTGRES_URL_NON_POOLING"] ??
  "postgresql://archispark:archispark@localhost:5432/archispark";

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(connectionString);

function stripSslmode(cs: string): string {
  try {
    const u = new URL(cs);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return cs;
  }
}

const client = new pg.Client({
  connectionString: isLocal ? connectionString : stripSslmode(connectionString),
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
console.log("Running demo seed…");
await client.query(sql);
console.log("Done.");
await client.end();
