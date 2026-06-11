import { migrate as neonMigrate } from "drizzle-orm/neon-serverless/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { join } from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";
import { USE_PGLITE } from "./connection.js";

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
