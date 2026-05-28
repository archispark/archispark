import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "path";
import { db } from "./connection.js";

export function runMigrations(): void {
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
}
