/**
 * Local-dev tenant database provisioning.
 *
 * Local dev runs against the Postgres instance started by
 * `.docker/docker-compose.dev.yml` (see `DATABASE_URL`) — there is no Neon
 * project to call out to. This module is the local equivalent of
 * `provisionNeonTenantInfrastructure` (tenant-provisioning.ts): it creates a
 * dedicated `tenant_<sanitized org id>` database on that same Postgres
 * instance (reusing the `DATABASE_URL` role/credentials), runs the
 * tenant-only migrations against it, and returns a client + connection
 * string for the caller to seed and activate — same `tenant_databases` row
 * shape as the Neon path (`neonProjectId: null`).
 *
 * Used by `provisionTenantInfrastructure` whenever `NEON_API_KEY`/
 * `NEON_PROJECT_ID` are not set and `DATABASE_URL` points at a local Postgres
 * (see `canProvisionLocally`). Neon stays the only path for preview/production.
 */

import type { Pool } from "pg";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { controlDb, createTenantDb, USE_PGLITE, isLocalConnectionString } from "./connection.js";
import { runTenantMigrations } from "./migrate-tenant.js";
import { sanitizeIdentifier, markTenantDatabaseError } from "./tenant-db-helpers.js";

export interface LocalProvisionTenantInfrastructureOptions {
  /** Test-only: build a Drizzle client for the new database without a real connection. */
  tenantDbFactory?: (connectionString: string) => NodePgDatabase<typeof schema>;
  /** Test-only: override `CREATE DATABASE` (PGlite has no multi-database support). */
  createDatabase?: (databaseName: string) => Promise<void>;
}

export interface LocalTenantInfrastructure {
  tenantDb: NodePgDatabase<typeof schema>;
  connectionString: string;
}

/**
 * `true` when local-Postgres tenant provisioning is available: a real
 * Postgres `DATABASE_URL` (not PGlite/tests) pointing at a local instance.
 */
export function canProvisionLocally(): boolean {
  const url = process.env["DATABASE_URL"];
  return !USE_PGLITE && !!url && isLocalConnectionString(url);
}

/** Returns `DATABASE_URL` with its database name replaced by `databaseName`. */
export function buildLocalTenantConnectionString(databaseName: string): string {
  const base = process.env["DATABASE_URL"];
  if (!base) throw new Error("DATABASE_URL is required for local tenant provisioning");
  const u = new URL(base);
  u.pathname = `/${databaseName}`;
  return u.toString();
}

/**
 * Creates `databaseName` on the local Postgres instance if it doesn't already
 * exist. `CREATE DATABASE` cannot run inside a transaction — runs on a fresh
 * connection from the control DB's pool (same pattern as `ensureTenantRole`).
 */
/* v8 ignore start -- requires real Postgres; PGlite has no multi-database support */
async function createLocalDatabase(databaseName: string): Promise<void> {
  const pool = (controlDb as unknown as { $client: Pool }).$client;
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ exists: number }>("SELECT 1 AS exists FROM pg_database WHERE datname = $1", [databaseName]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    client.release();
  }
}
/* v8 ignore stop */

/**
 * Local-Postgres equivalent of `provisionNeonTenantInfrastructure`: creates
 * `organizationId`'s dedicated database on the local Postgres instance and
 * runs the tenant migrations against it. Leaves `tenant_databases.status` as
 * `"provisioning"` — callers seed/copy data and then call
 * `activateTenantDatabase`.
 *
 * Returns `undefined` if the organization's database is already `"active"`
 * or `"provisioning"`.
 */
export async function provisionLocalTenantInfrastructure(
  organizationId: string,
  options: LocalProvisionTenantInfrastructureOptions = {},
): Promise<LocalTenantInfrastructure | undefined> {
  const [existing] = await controlDb.select().from(schema.tenantDatabases)
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
  if (existing?.status === "active" || existing?.status === "provisioning") return undefined;

  const slug = sanitizeIdentifier(organizationId);
  const databaseName = `tenant_${slug}`;
  const roleName = new URL(process.env["DATABASE_URL"] ?? "postgresql://archispark@localhost/archispark").username;

  if (existing) {
    await controlDb.update(schema.tenantDatabases).set({ status: "provisioning", updatedAt: new Date() })
      .where(eq(schema.tenantDatabases.organizationId, organizationId));
  } else {
    await controlDb.insert(schema.tenantDatabases).values({
      organizationId, neonProjectId: null,
      neonDatabaseName: databaseName, neonRoleName: roleName,
      connectionStringEncrypted: "", status: "provisioning",
    });
  }

  try {
    /* v8 ignore next -- requires real Postgres; tests inject createDatabase */
    await (options.createDatabase ?? createLocalDatabase)(databaseName);
    const connectionString = buildLocalTenantConnectionString(databaseName);

    /* v8 ignore next -- real local databases only; tests inject tenantDbFactory */
    const tenantDb = options.tenantDbFactory?.(connectionString) ?? createTenantDb(connectionString);

    await runTenantMigrations(tenantDb);
    return { tenantDb, connectionString };
  } catch (err) {
    await markTenantDatabaseError(organizationId, err);
    throw err;
  }
}
