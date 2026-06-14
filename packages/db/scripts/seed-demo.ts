/**
 * Demo seed script — loads ArchiMetal + ArchiSurance workspaces into the DB.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Requires:
 *   TENANT_DATABASE_URL — tenant fallback DB (workspaces, elements, …)
 *   KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 *   KEYCLOAK_ADMIN_CLIENT_SECRET — used to look up the first Keycloak
 *                                  organization via the Phasetwo Orgs API
 *
 * Both workspaces are created inside the first organization returned by
 * Keycloak.
 * Destructive reset: deletes existing ArchiSurance/ArchiMetal workspaces (CASCADE)
 * then reimports from the generated SQL. Safe to run multiple times.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { listOrganizations } from "@workspace/auth";

const TENANT_SQL_PATH = resolve(import.meta.dirname, "../seeds/demo.sql");
const tenantSqlTemplate = readFileSync(TENANT_SQL_PATH, "utf-8");

const tenantUrl = process.env["TENANT_DATABASE_URL"];
if (!tenantUrl) {
  console.error("Error: TENANT_DATABASE_URL is required.");
  process.exit(1);
}

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

const orgs = await listOrganizations();
const org = orgs[0];
if (!org?.id) {
  console.error("Error: no organization found in Keycloak. Create one first.");
  process.exit(1);
}
const orgId = org.id;
console.log(`Using organization: ${orgId} (${org.name})`);

const tenantSql = tenantSqlTemplate.replaceAll("'__ORG_ID__'", `'${orgId}'`);

const tenantClient = makeClient(tenantUrl);
await tenantClient.connect();
console.log("Seeding tenant DB (workspaces, elements, views)…");
await tenantClient.query(tenantSql);
await tenantClient.end();

console.log("Done.");
