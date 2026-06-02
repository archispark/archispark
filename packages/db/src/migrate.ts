import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "path";
import { fileURLToPath } from "url";
import { db, USE_PGLITE } from "./connection.js";

const MIGRATIONS_PG = join(fileURLToPath(new URL("../drizzle-pg", import.meta.url)));

export async function runMigrations(): Promise<void> {
  // v8 ignore start
  if (USE_PGLITE) {
    // Indirect specifier so the production bundler doesn't pull the PGlite
    // migrator (WASM, test-only) into the serverless function. See connection.ts.
    const pgliteMigratorPkg = "drizzle-orm/pglite/migrator";
    const { migrate: pgliteMigrate } = await import(pgliteMigratorPkg);
    await pgliteMigrate(db as unknown as Parameters<typeof pgliteMigrate>[0], { migrationsFolder: MIGRATIONS_PG });
    return;
  }
  // v8 ignore stop
  await pgMigrate(db as unknown as Parameters<typeof pgMigrate>[0], { migrationsFolder: MIGRATIONS_PG });
}
