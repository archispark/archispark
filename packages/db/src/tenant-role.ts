import type { Pool } from "pg";
import { controlDb, tenantFallbackDb, USE_PGLITE } from "./connection.js";

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
 *
 * Role creation and password update run against the control database (cluster-
 * level operations). Table grants run against the tenant fallback database
 * (archispark_tenant) so they apply to the correct physical database.
 *
 * Called by control-api startup after runMigrations() so the role and its
 * grants are always in sync after schema changes.
 *
 * No-op under PGlite (test suite) or when `password` is empty.
 */
export async function ensureTenantRole(password: string): Promise<void> {
  if (USE_PGLITE || !password) return;

  /* v8 ignore start -- production-only: never reached under PGlite/VITEST */

  // CREATE ROLE + ALTER ROLE: cluster-level, run against control DB
  const controlPool = (controlDb as unknown as { $client: Pool }).$client;
  const controlClient = await controlPool.connect();
  try {
    await controlClient.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TENANT_DB_ROLE}') THEN
          CREATE ROLE ${TENANT_DB_ROLE} WITH LOGIN NOINHERIT;
        END IF;
      END $$
    `);
    await controlClient.query(
      `ALTER ROLE "${TENANT_DB_ROLE}" WITH PASSWORD ${controlClient.escapeLiteral(password)}`,
    );
  } finally {
    controlClient.release();
  }

  // GRANT: per-database — must connect to the tenant fallback DB (archispark_tenant)
  // so the grants apply to the correct physical database.
  const tenantPool = (tenantFallbackDb as unknown as { $client: Pool }).$client;
  const tenantClient = await tenantPool.connect();
  try {
    const tableList = TENANT_TABLES.map((t) => `"${t}"`).join(", ");
    await tenantClient.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tableList} TO "${TENANT_DB_ROLE}"`,
    );
    await tenantClient.query(
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO "${TENANT_DB_ROLE}"`,
    );
  } finally {
    tenantClient.release();
  }

  /* v8 ignore stop */
}
