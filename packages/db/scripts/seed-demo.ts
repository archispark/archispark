/**
 * Demo seed script — loads ArchiMetal + ArchiSurance workspaces into the DB,
 * owned by the "archi" demo user.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Requires:
 *   DATABASE_URL — the shared database (workspaces, elements, …)
 *   KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 *   KEYCLOAK_ADMIN_CLIENT_SECRET — used to look up the "archi" demo user's
 *                                  Keycloak sub (run seed:demo-users first)
 *
 * Destructive reset: deletes existing ArchiSurance/ArchiMetal workspaces (CASCADE)
 * then reimports from the generated SQL. Safe to run multiple times.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { findUserByUsername } from "@workspace/auth";

const SQL_PATH = resolve(import.meta.dirname, "../seeds/demo.sql");
const sqlTemplate = readFileSync(SQL_PATH, "utf-8");

const dbUrl = process.env["DATABASE_URL"];
if (!dbUrl) {
  console.error("Error: DATABASE_URL is required.");
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

const owner = await findUserByUsername("archi");
if (!owner?.id) {
  console.error('Error: demo user "archi" not found in Keycloak. Run `pnpm --filter @workspace/db seed:demo-users` first.');
  process.exit(1);
}
const ownerId = owner.id;
console.log(`Using owner: ${ownerId} (archi)`);

const sql = sqlTemplate.replaceAll("'__OWNER_ID__'", `'${ownerId}'`);

const client = makeClient(dbUrl);
await client.connect();
console.log("Seeding workspaces (elements, views)…");
await client.query(sql);
await client.end();

console.log("Done.");
