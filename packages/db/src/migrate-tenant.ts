import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { migrate as neonMigrate } from "drizzle-orm/neon-serverless/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { join } from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";
import { USE_PGLITE, tenantFallbackDb, controlDb } from "./connection.js";

// Same dist/ vs source resolution as migrate.ts, but for the tenant-only
// migration folder (schema.tenant.ts — no control-plane FKs).
const _migrateDir = new URL(import.meta.url).pathname.includes("/dist/") ? "./drizzle-pg/tenant" : "../drizzle-pg/tenant";
export const TENANT_MIGRATIONS_PG = join(fileURLToPath(new URL(_migrateDir, import.meta.url)));

/**
 * Runs the tenant-only migrations (drizzle-pg/tenant) against a freshly
 * provisioned tenant database (see provisionTenantDatabase).
 */
export async function runTenantMigrations(tenantDb: NodePgDatabase<typeof schema>): Promise<void> {
  if (USE_PGLITE) {
    // Indirect specifier: keep this test-only dep (PGlite ships WASM) out of
    // the production serverless bundle — see connection.ts.
    const pgliteMigratorPkg = "drizzle-orm/pglite/migrator";
    const { migrate: pgliteMigrate } = await import(pgliteMigratorPkg);
    await pgliteMigrate(tenantDb as unknown as Parameters<typeof pgliteMigrate>[0], { migrationsFolder: TENANT_MIGRATIONS_PG });
    return;
  }
  /* v8 ignore start -- real tenant databases only (neon-http), unreachable under PGlite tests */
  await neonMigrate(tenantDb as unknown as Parameters<typeof neonMigrate>[0], { migrationsFolder: TENANT_MIGRATIONS_PG });
  /* v8 ignore stop */
}

/**
 * Runs the tenant-only migrations against the shared tenant fallback database
 * (archispark_tenant). Called by tenant-api at startup so the fallback DB
 * always has an up-to-date schema.
 *
 * No-op under PGlite (controlDb == tenantFallbackDb, already migrated by
 * runMigrations) and when TENANT_DATABASE_URL is not set (same condition).
 */
export async function runTenantFallbackMigrations(): Promise<void> {
  if (USE_PGLITE || tenantFallbackDb === controlDb) return;

  /* v8 ignore start -- requires live separate tenant DB */
  await pgMigrate(tenantFallbackDb as unknown as Parameters<typeof pgMigrate>[0], { migrationsFolder: TENANT_MIGRATIONS_PG });
  /* v8 ignore stop */
}
