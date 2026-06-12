/**
 * Demo seed script — loads ArchiMetal + ArchiSurance workspaces into the DB.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Requires:
 *   DATABASE_URL        — control DB (organizations, members)
 *   TENANT_DATABASE_URL — tenant fallback DB (workspaces, elements, …)
 *                         Falls back to DATABASE_URL for unified local dev.
 *
 * Destructive reset: deletes existing ArchiSurance/ArchiMetal workspaces (CASCADE)
 * then reimports from the generated SQL. Safe to run multiple times.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const CONTROL_SQL_PATH = resolve(import.meta.dirname, "../seeds/demo-control.sql");
const TENANT_SQL_PATH = resolve(import.meta.dirname, "../seeds/demo.sql");
const controlSql = readFileSync(CONTROL_SQL_PATH, "utf-8");
const tenantSql = readFileSync(TENANT_SQL_PATH, "utf-8");

const controlUrl = process.env["DATABASE_URL"];
if (!controlUrl) {
  console.error("Error: DATABASE_URL is required.");
  process.exit(1);
}

const tenantUrl = process.env["TENANT_DATABASE_URL"] ?? controlUrl;

const isLocal = (url: string) =>
  /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(url);

function stripSslmode(cs: string): string {
  try {
    const u = new URL(cs);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return cs;
  }
}

function makeClient(url: string): pg.Client {
  const local = isLocal(url);
  return new pg.Client({
    connectionString: local ? url : stripSslmode(url),
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
}

const controlClient = makeClient(controlUrl);
await controlClient.connect();
console.log("Seeding control DB (organizations, members)…");
await controlClient.query(controlSql);
await controlClient.end();

const tenantClient = makeClient(tenantUrl);
await tenantClient.connect();
console.log("Seeding tenant DB (workspaces, elements, views)…");
await tenantClient.query(tenantSql);
await tenantClient.end();

console.log("Done.");
