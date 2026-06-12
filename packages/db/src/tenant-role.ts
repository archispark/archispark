import type { Pool } from "pg";
import { controlDb, USE_PGLITE } from "./connection.js";

export const TENANT_DB_ROLE = "archispark_tenant";

/**
 * SQL names of every table defined in schema.tenant.ts.
 * Keep in sync when adding new tenant tables — these are the only tables
 * the `archispark_tenant` role is allowed to touch.
 */
export const TENANT_TABLES: readonly string[] = [
  "workspaces",
  "workspace_teams",
  "user_active_workspace",
  "elements",
  "relationships",
  "property_definitions",
  "element_properties",
  "relationship_properties",
  "views",
  "nodes",
  "connections",
  "bendpoints",
];

/**
 * Idempotently creates the `archispark_tenant` Postgres role and grants it
 * SELECT/INSERT/UPDATE/DELETE on all tenant tables plus USAGE on all sequences.
 * Called by control-api startup after runMigrations() so the role and its
 * grants are always in sync after schema changes.
 *
 * No-op under PGlite (test suite) or when `password` is empty.
 */
export async function ensureTenantRole(password: string): Promise<void> {
  if (USE_PGLITE || !password) return;

  /* v8 ignore start -- production-only: never reached under PGlite/VITEST */
  const pool = (controlDb as unknown as { $client: Pool }).$client;
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TENANT_DB_ROLE}') THEN
          CREATE ROLE ${TENANT_DB_ROLE} WITH LOGIN NOINHERIT;
        END IF;
      END $$
    `);
    await client.query(
      `ALTER ROLE "${TENANT_DB_ROLE}" WITH PASSWORD ${client.escapeLiteral(password)}`,
    );
    const tableList = TENANT_TABLES.map((t) => `"${t}"`).join(", ");
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tableList} TO "${TENANT_DB_ROLE}"`,
    );
    await client.query(
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO "${TENANT_DB_ROLE}"`,
    );
  } finally {
    client.release();
  }
  /* v8 ignore stop */
}
