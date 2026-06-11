/**
 * Phase 3 — operator script: migrates an organization's ArchiMate content
 * (workspaces and all their elements/relationships/views/properties, plus
 * `workspace_teams` and `user_active_workspace`) from the shared
 * control-plane database to its own dedicated Neon database.
 *
 * Usage:
 *   tsx scripts/migrate-existing-tenant.ts <organizationId>
 *   tsx scripts/migrate-existing-tenant.ts --all
 *   tsx scripts/migrate-existing-tenant.ts <organizationId> --cleanup --yes
 *   tsx scripts/migrate-existing-tenant.ts --all --cleanup --yes
 *
 * Without --cleanup: provisions (or resumes provisioning of) the
 * organization's dedicated database, copies its content there, and marks
 * `tenant_databases.status = "active"`. The shared database rows are left
 * untouched — verify the new database, then re-run with --cleanup --yes.
 *
 * With --cleanup --yes: irreversibly deletes the organization's rows from
 * the shared database. Refuses unless `tenant_databases.status === "active"`
 * and the tenant database holds at least as many workspaces as the shared
 * database.
 *
 * Requires NEON_API_KEY / NEON_PROJECT_ID / TENANT_DB_ENCRYPTION_KEY.
 */

import { eq } from "drizzle-orm";
import {
  controlDb, getTenantDb,
  organizations, tenantDatabases, workspaces,
  migrateExistingTenant, cleanupMigratedSharedData,
} from "@workspace/db";

async function countSourceWorkspaces(organizationId: string): Promise<number> {
  const rows = await controlDb.select({ id: workspaces.id }).from(workspaces)
    .where(eq(workspaces.organizationId, organizationId));
  return rows.length;
}

async function countTenantWorkspaces(organizationId: string): Promise<number> {
  const tenantDb = await getTenantDb(organizationId);
  const rows = await tenantDb.select({ id: workspaces.id }).from(workspaces)
    .where(eq(workspaces.organizationId, organizationId));
  return rows.length;
}

async function orgsPendingMigration(): Promise<string[]> {
  const orgs = await controlDb.select({ id: organizations.id }).from(organizations);
  const tdRows = await controlDb.select().from(tenantDatabases);
  const statusByOrg = new Map(tdRows.map((r) => [r.organizationId, r.status]));
  return orgs.map((o) => o.id).filter((id) => {
    const status = statusByOrg.get(id);
    return status !== "active" && status !== "provisioning";
  });
}

async function orgsPendingCleanup(): Promise<string[]> {
  const tdRows = await controlDb.select().from(tenantDatabases).where(eq(tenantDatabases.status, "active"));
  return tdRows.map((r) => r.organizationId);
}

async function migrateOrg(organizationId: string): Promise<void> {
  const result = await migrateExistingTenant(organizationId);
  if (!result.migrated) {
    console.log(`[migrate] ${organizationId}: skipped (already active/provisioning, or Neon API not configured)`);
    return;
  }
  console.log(`[migrate] ${organizationId}: copied ${result.workspacesMigrated} workspace(s), tenant database active`);
}

async function cleanupOrg(organizationId: string): Promise<void> {
  const sourceCount = await countSourceWorkspaces(organizationId);
  const tenantCount = await countTenantWorkspaces(organizationId);
  if (tenantCount < sourceCount) {
    throw new Error(
      `tenant database has ${tenantCount} workspace(s), shared database has ${sourceCount} — run the migration step first`,
    );
  }
  const deleted = await cleanupMigratedSharedData(organizationId);
  console.log(`[cleanup] ${organizationId}: deleted ${deleted} workspace(s) from the shared database (tenant database has ${tenantCount})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cleanup = args.includes("--cleanup");
  const yes = args.includes("--yes");
  const all = args.includes("--all");
  const organizationId = args.find((a) => !a.startsWith("--"));

  if (!all && !organizationId) {
    console.error("Usage: tsx scripts/migrate-existing-tenant.ts <organizationId> [--cleanup --yes]");
    console.error("       tsx scripts/migrate-existing-tenant.ts --all [--cleanup --yes]");
    process.exit(1);
  }

  if (cleanup && !yes) {
    console.error("--cleanup is irreversible: pass --yes to confirm");
    process.exit(1);
  }

  const targets = all ? await (cleanup ? orgsPendingCleanup() : orgsPendingMigration()) : [organizationId!];

  if (targets.length === 0) {
    console.log(cleanup ? "No organizations with an active tenant database to clean up." : "No organizations pending migration.");
    return;
  }

  let failures = 0;
  for (const id of targets) {
    try {
      await (cleanup ? cleanupOrg(id) : migrateOrg(id));
    } catch (err) {
      failures++;
      console.error(`[${cleanup ? "cleanup" : "migrate"}] ${id}: failed —`, err);
    }
  }
  if (failures > 0) process.exitCode = 1;
}

await main();
process.exit(process.exitCode ?? 0);
