/**
 * Phase 3 — migrates an existing organization's ArchiMate content out of the
 * shared control-plane database into its own dedicated Neon database.
 *
 * `migrateExistingTenant(organizationId)`:
 *   1. Provisions the tenant database infrastructure (see
 *      `provisionTenantInfrastructure`) — Neon role + database, tenant
 *      migrations applied, `tenant_databases.status = "provisioning"`.
 *   2. For every workspace owned by `organizationId` in the shared database:
 *      reads its full `ArchiModel` and re-creates it in the new database
 *      (preserving name, content and ArchiMate ids — only the internal
 *      serial `workspaces.id` changes).
 *   3. Copies the `workspace_teams` and `user_active_workspace` rows for
 *      those workspaces, remapped to the new workspace ids.
 *   4. Marks `tenant_databases.status = "active"` — from this point
 *      `getTenantDb` resolves the organization to its dedicated database.
 *
 * Does NOT delete the migrated rows from the shared database — see
 * `cleanupMigratedSharedData`, a separate explicit step to run only after
 * verifying the new tenant database.
 */

import { eq, inArray } from "drizzle-orm";
import * as schema from "./schema.js";
import { controlDb, db, runWithTenantDb } from "./connection.js";
import { modelFromDb, seedWorkspace } from "./model-io.js";
import {
  provisionTenantInfrastructure, activateTenantDatabase,
  type ProvisionTenantInfrastructureOptions,
} from "./tenant-provisioning.js";
import { getNeonApiConfig } from "./neon-api.js";

export interface MigrateExistingTenantResult {
  /** False when Neon API credentials are not configured, or the organization is already active/provisioning. */
  migrated: boolean;
  workspacesMigrated: number;
}

/**
 * Migrates `organizationId`'s workspaces (and their content,
 * `workspace_teams` and `user_active_workspace` rows) from the shared
 * database to a newly provisioned dedicated database, then marks it active.
 *
 * No-op (`migrated: false`) if Neon API credentials are not configured, or
 * the organization's database is already `"active"`/`"provisioning"`.
 */
export async function migrateExistingTenant(
  organizationId: string,
  options: ProvisionTenantInfrastructureOptions = {},
): Promise<MigrateExistingTenantResult> {
  const config = getNeonApiConfig();
  const infra = await provisionTenantInfrastructure(organizationId, options);
  if (!config || !infra) return { migrated: false, workspacesMigrated: 0 };

  const sourceWorkspaces = await controlDb.select().from(schema.workspaces)
    .where(eq(schema.workspaces.organizationId, organizationId));

  const workspaceIdMap = new Map<number, number>();
  for (const ws of sourceWorkspaces) {
    const model = await modelFromDb(ws.id);
    const newWorkspaceId = await runWithTenantDb(infra.tenantDb, () => seedWorkspace(ws.name, model, organizationId));
    workspaceIdMap.set(ws.id, newWorkspaceId);
  }

  if (sourceWorkspaces.length > 0) {
    const oldWorkspaceIds = sourceWorkspaces.map((w) => w.id);

    const teamRows = await controlDb.select().from(schema.workspaceTeams)
      .where(inArray(schema.workspaceTeams.workspaceId, oldWorkspaceIds));
    for (const row of teamRows) {
      const newWorkspaceId = workspaceIdMap.get(row.workspaceId);
      if (newWorkspaceId == null) continue;
      await runWithTenantDb(infra.tenantDb, () =>
        db.insert(schema.workspaceTeams).values({ workspaceId: newWorkspaceId, teamId: row.teamId }));
    }

    const activeRows = await controlDb.select().from(schema.userActiveWorkspace)
      .where(eq(schema.userActiveWorkspace.organizationId, organizationId));
    for (const row of activeRows) {
      const newWorkspaceId = workspaceIdMap.get(row.workspaceId);
      if (newWorkspaceId == null) continue;
      await runWithTenantDb(infra.tenantDb, () =>
        db.insert(schema.userActiveWorkspace).values({
          userId: row.userId, organizationId: row.organizationId, workspaceId: newWorkspaceId,
        }));
    }
  }

  await activateTenantDatabase(organizationId, infra.connectionString, config.projectId);
  return { migrated: true, workspacesMigrated: sourceWorkspaces.length };
}

/**
 * Deletes `organizationId`'s workspaces (and all their content,
 * `workspace_teams` and `user_active_workspace` rows) from the shared
 * database. Irreversible — only call after `migrateExistingTenant` has
 * completed and the new tenant database has been verified.
 *
 * Refuses to run unless `tenant_databases.status === "active"` for this
 * organization.
 */
export async function cleanupMigratedSharedData(organizationId: string): Promise<number> {
  const [row] = await controlDb.select().from(schema.tenantDatabases)
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
  if (row?.status !== "active") {
    throw new Error(`Refusing to clean up shared data for organization ${organizationId}: tenant database is not active`);
  }

  const wsRows = await controlDb.select({ id: schema.workspaces.id }).from(schema.workspaces)
    .where(eq(schema.workspaces.organizationId, organizationId));
  if (wsRows.length === 0) return 0;
  const wsIds = wsRows.map((w) => w.id);

  await controlDb.delete(schema.userActiveWorkspace).where(eq(schema.userActiveWorkspace.organizationId, organizationId));
  await controlDb.delete(schema.workspaceTeams).where(inArray(schema.workspaceTeams.workspaceId, wsIds));
  // elements/relationships/property_definitions/views (and their children) cascade on workspace delete.
  await controlDb.delete(schema.workspaces).where(eq(schema.workspaces.organizationId, organizationId));
  return wsIds.length;
}
