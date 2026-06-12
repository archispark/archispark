/**
 * Demo seed script — loads ArchiMetal + ArchiSurance workspaces into the DB.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Requires:
 *   DATABASE_URL        — control DB (reads first organization id)
 *   TENANT_DATABASE_URL — tenant fallback DB (workspaces, elements, …)
 *                         Falls back to DATABASE_URL for unified local dev.
 *
 * Both workspaces are created inside the first existing organization.
 * Destructive reset: deletes existing ArchiSurance/ArchiMetal workspaces (CASCADE)
 * then reimports from the generated SQL. Safe to run multiple times.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const TENANT_SQL_PATH = resolve(import.meta.dirname, "../seeds/demo.sql");
const tenantSqlTemplate = readFileSync(TENANT_SQL_PATH, "utf-8");

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
const { rows } = await controlClient.query<{ id: string }>(
  "SELECT id FROM organization ORDER BY created_at LIMIT 1"
);
await controlClient.end();

if (!rows[0]) {
  console.error("Error: no organization found in control DB. Create one first.");
  process.exit(1);
}
const orgId = rows[0].id;
console.log(`Using organization: ${orgId}`);

const tenantSql = tenantSqlTemplate.replaceAll("'__ORG_ID__'", `'${orgId}'`);

const tenantClient = makeClient(tenantUrl);
await tenantClient.connect();
console.log("Seeding tenant DB (workspaces, elements, views)…");
await tenantClient.query(tenantSql);
await tenantClient.end();

console.log("Done.");
