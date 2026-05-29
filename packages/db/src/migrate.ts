import { migrate as sqliteMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "path";
import { fileURLToPath } from "url";
import { db, dbDriver } from "./connection.js";

const MIGRATIONS_SQLITE = join(fileURLToPath(new URL("../drizzle", import.meta.url)));
const MIGRATIONS_PG     = join(fileURLToPath(new URL("../drizzle-pg", import.meta.url)));

export async function runMigrations(): Promise<void> {
  if (dbDriver === "postgres") {
    await pgMigrate(db as Parameters<typeof pgMigrate>[0], { migrationsFolder: MIGRATIONS_PG });
  } else {
    sqliteMigrate(db as Parameters<typeof sqliteMigrate>[0], { migrationsFolder: MIGRATIONS_SQLITE });
  }
}
