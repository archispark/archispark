/**
 * Phase 3 — provisions a dedicated Neon database for a tenant organization.
 *
 * `provisionTenantInfrastructure(organizationId)`:
 *   1. Creates a Postgres role + database via the Neon API (the database is
 *      owned by the role, scoping access to it).
 *   2. Runs the tenant-only migrations (drizzle-pg/tenant) against the new
 *      database.
 *   3. Records the row in `tenant_databases` with `status: "provisioning"`
 *      and returns the new (empty) tenant database client + connection
 *      string — callers seed/copy data and then activate the row.
 *
 * `provisionTenantDatabase(organizationId)` builds on top of that for brand
 * new organizations: seeds a default "Default" workspace (empty model) and
 * marks the row `"active"`. `migrateExistingTenant` (tenant-migration.ts)
 * is the equivalent for organizations that already have content in the
 * shared database.
 *
 * Both are no-ops while `NEON_API_KEY` / `NEON_PROJECT_ID` are not configured
 * (see `getNeonApiConfig`) — organizations keep sharing the control-plane
 * database (transitional mode).
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { controlDb, createTenantDb, runWithTenantDb } from "./connection.js";
import { runTenantMigrations } from "./migrate-tenant.js";
import { seedWorkspace } from "./model-io.js";
import { encryptConnectionString } from "./tenant-crypto.js";
import {
  getNeonApiConfig, getDefaultBranchId, createRole, createDatabase, getConnectionUri,
} from "./neon-api.js";
import type { ArchiModel } from "./model.js";

export interface ProvisionTenantInfrastructureOptions {
  /** Test-only: build a Drizzle client for the new database without going through neon-serverless. */
  tenantDbFactory?: (connectionString: string) => NodePgDatabase<typeof schema>;
}

export type ProvisionTenantDatabaseOptions = ProvisionTenantInfrastructureOptions;

export interface TenantInfrastructure {
  tenantDb: NodePgDatabase<typeof schema>;
  connectionString: string;
}

const DEFAULT_WORKSPACE_NAME = "Default";

/** Postgres identifiers must be lowercase alphanumeric/underscore. */
function sanitizeIdentifier(organizationId: string): string {
  return organizationId.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function emptyModel(): ArchiModel {
  return {
    uuid: `id-${randomUUID()}`,
    name: DEFAULT_WORKSPACE_NAME,
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
  };
}

async function markTenantDatabaseError(organizationId: string, err?: unknown): Promise<void> {
  const lastError = err instanceof Error ? err.message : (err ? String(err) : null);
  await controlDb.update(schema.tenantDatabases).set({ status: "error", lastError, updatedAt: new Date() })
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
}

/**
 * Marks `organizationId`'s tenant database `"active"` with the given
 * connection string — from this point `getTenantDb` resolves the
 * organization to its dedicated database.
 */
export async function activateTenantDatabase(
  organizationId: string,
  connectionString: string,
  neonProjectId: string | null,
): Promise<void> {
  await controlDb.update(schema.tenantDatabases).set({
    neonProjectId,
    connectionStringEncrypted: encryptConnectionString(connectionString),
    status: "active",
    updatedAt: new Date(),
  }).where(eq(schema.tenantDatabases.organizationId, organizationId));
}

/**
 * Creates (or retries creating) `organizationId`'s dedicated database
 * infrastructure: Neon role + database, tenant migrations applied. Leaves
 * `tenant_databases.status` as `"provisioning"` — callers seed/copy data and
 * then call `activateTenantDatabase`.
 *
 * Returns `undefined` (no-op) if Neon API credentials are not configured, or
 * if the organization's database is already `"active"` or `"provisioning"`.
 */
export async function provisionTenantInfrastructure(
  organizationId: string,
  options: ProvisionTenantInfrastructureOptions = {},
): Promise<TenantInfrastructure | undefined> {
  const config = getNeonApiConfig();
  if (!config) return undefined;

  const [existing] = await controlDb.select().from(schema.tenantDatabases)
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
  if (existing?.status === "active" || existing?.status === "provisioning") return undefined;

  const slug = sanitizeIdentifier(organizationId);
  const databaseName = `tenant_${slug}`;
  const roleName = `tenant_${slug}`;

  if (existing) {
    await controlDb.update(schema.tenantDatabases).set({ status: "provisioning", updatedAt: new Date() })
      .where(eq(schema.tenantDatabases.organizationId, organizationId));
  } else {
    await controlDb.insert(schema.tenantDatabases).values({
      organizationId, neonProjectId: config.projectId,
      neonDatabaseName: databaseName, neonRoleName: roleName,
      connectionStringEncrypted: "", status: "provisioning",
    });
  }

  try {
    const branchId = await getDefaultBranchId(config);
    await createRole(config, branchId, roleName);
    await createDatabase(config, branchId, databaseName, roleName);
    const connectionString = await getConnectionUri(config, branchId, databaseName, roleName);

    /* v8 ignore next -- real tenant databases only (neon-serverless); tests inject tenantDbFactory */
    const tenantDb = options.tenantDbFactory?.(connectionString) ?? createTenantDb(connectionString);

    await runTenantMigrations(tenantDb);
    return { tenantDb, connectionString };
  } catch (err) {
    await markTenantDatabaseError(organizationId, err);
    throw err;
  }
}

/**
 * Provisions a brand new organization's dedicated database: infrastructure
 * (see `provisionTenantInfrastructure`) plus a default "Default" workspace,
 * then marks it `"active"`.
 */
export async function provisionTenantDatabase(
  organizationId: string,
  options: ProvisionTenantDatabaseOptions = {},
): Promise<void> {
  const config = getNeonApiConfig();
  const infra = await provisionTenantInfrastructure(organizationId, options);
  if (!config || !infra) return;

  try {
    await runWithTenantDb(infra.tenantDb, () => seedWorkspace(DEFAULT_WORKSPACE_NAME, emptyModel(), organizationId));
    await activateTenantDatabase(organizationId, infra.connectionString, config.projectId);
  } catch (err) {
    await markTenantDatabaseError(organizationId, err);
    throw err;
  }
}
