import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "path";
import { fileURLToPath } from "url";
import { db, USE_PGLITE } from "./connection.js";

const MIGRATIONS_PG = join(fileURLToPath(new URL("../drizzle-pg", import.meta.url)));

export async function runMigrations(): Promise<void> {
  // v8 ignore start
  if (USE_PGLITE) {
    const { migrate: pgliteMigrate } = await import("drizzle-orm/pglite/migrator");
    await pgliteMigrate(db as unknown as Parameters<typeof pgliteMigrate>[0], { migrationsFolder: MIGRATIONS_PG });
    return;
  }
  // v8 ignore stop
  await pgMigrate(db as unknown as Parameters<typeof pgMigrate>[0], { migrationsFolder: MIGRATIONS_PG });
}
