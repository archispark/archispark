/**
 * Phase 3 — provisions a dedicated database for a tenant organization.
 *
 * `provisionTenantInfrastructure(organizationId)` dispatches to one of two
 * backends, both producing the same `{ tenantDb, connectionString }` shape
 * and the same `tenant_databases` row:
 *
 *   - **Neon** (`provisionNeonTenantInfrastructure`, preview/production):
 *     when `NEON_API_KEY`/`NEON_PROJECT_ID` are configured. Creates a
 *     Postgres role + database via the Neon API.
 *   - **Local** (`provisionLocalTenantInfrastructure`, see
 *     `local-provisioning.ts`, dev only): when Neon isn't configured but
 *     `DATABASE_URL` points at a local Postgres (`canProvisionLocally`).
 *     Creates `tenant_<sanitized org id>` on that same instance.
 *
 * Either way:
 *   1. Runs the tenant-only migrations (drizzle-pg/tenant) against the new
 *      database.
 *   2. Records the row in `tenant_databases` with `status: "provisioning"`
 *      and returns the new (empty) tenant database client + connection
 *      string — callers seed/copy data and then activate the row.
 *
 * `provisionTenantDatabase(organizationId)` builds on top of that for brand
 * new organizations: seeds a default "Default" workspace (empty model) and
 * marks the row `"active"`. `migrateExistingTenant` (tenant-migration.ts)
 * is the equivalent for organizations that already have content in the
 * shared database.
 *
 * Both are no-ops when neither backend is available — organizations keep
 * sharing the control-plane database (transitional mode).
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
import type { NeonApiConfig } from "./neon-api.js";
import { canProvisionLocally, provisionLocalTenantInfrastructure } from "./local-provisioning.js";
import { sanitizeIdentifier, markTenantDatabaseError } from "./tenant-db-helpers.js";
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

/**
 * Marks `organizationId`'s tenant database `"active"` with the given
 * connection string — from this point `getTenantDb` resolves the
 * organization to its dedicated database. `neonProjectId` is `null` for
 * locally-provisioned tenant databases.
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
 * Creates (or retries creating) `organizationId`'s dedicated Neon database
 * infrastructure: Neon role + database, tenant migrations applied. Leaves
 * `tenant_databases.status` as `"provisioning"` — callers seed/copy data and
 * then call `activateTenantDatabase`.
 *
 * Returns `undefined` if the organization's database is already `"active"` or
 * `"provisioning"`.
 */
async function provisionNeonTenantInfrastructure(
  organizationId: string,
  config: NeonApiConfig,
  options: ProvisionTenantInfrastructureOptions,
): Promise<TenantInfrastructure | undefined> {
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
 * Creates (or retries creating) `organizationId`'s dedicated tenant database
 * infrastructure, via Neon if configured (preview/production) or the local
 * Postgres instance if not (dev — see `local-provisioning.ts`). Returns
 * `undefined` if neither backend is available, or the organization's database
 * is already `"active"`/`"provisioning"`.
 */
export async function provisionTenantInfrastructure(
  organizationId: string,
  options: ProvisionTenantInfrastructureOptions = {},
): Promise<TenantInfrastructure | undefined> {
  const config = getNeonApiConfig();
  if (config) return provisionNeonTenantInfrastructure(organizationId, config, options);
  if (canProvisionLocally()) return provisionLocalTenantInfrastructure(organizationId, options);
  return undefined;
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
  const infra = await provisionTenantInfrastructure(organizationId, options);
  if (!infra) return;

  try {
    await runWithTenantDb(infra.tenantDb, () => seedWorkspace(DEFAULT_WORKSPACE_NAME, emptyModel(), organizationId));
    await activateTenantDatabase(organizationId, infra.connectionString, getNeonApiConfig()?.projectId ?? null);
  } catch (err) {
    await markTenantDatabaseError(organizationId, err);
    throw err;
  }
}
