import Database from "better-sqlite3";
import { drizzle as sqliteDrizzle } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import * as schemaPg from "./schema-pg.js";

export type DbDriver = "sqlite" | "postgres";

// v8 ignore next
export const dbDriver: DbDriver =
  (process.env["DB_DRIVER"] as DbDriver | undefined) === "postgres" ? "postgres" : "sqlite";

function createDb(): BetterSQLite3Database<typeof schema> {
  if (dbDriver === "postgres") {
    const connectionString =
      process.env["DATABASE_URL"] ?? "postgresql://archispark:archispark@localhost:5432/archispark";
    const pool = new Pool({ connectionString });
    // Cast: PG and SQLite Drizzle share the same query API; the cast lets existing
    // code compile unchanged while the runtime uses the correct PG dialect.
    return pgDrizzle(pool, { schema: schemaPg }) as unknown as BetterSQLite3Database<typeof schema>;
  }

  const DEFAULT_DB_PATH = join(
    fileURLToPath(new URL("../../../data/archispark.db", import.meta.url)),
  );
  // v8 ignore next
  const dbPath = process.env["DB_PATH"] ?? DEFAULT_DB_PATH;
  mkdirSync(dirname(dbPath), { recursive: true });

  const raw = new Database(dbPath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  // also export the raw sqlite handle for callers that need it (e.g. better-auth)
  _sqlite = raw;
  return sqliteDrizzle(raw, { schema });
}

let _sqlite: InstanceType<typeof Database> | undefined;

export const db = createDb();
// Exposed for SQLite-only consumers (undefined in postgres mode)
export { _sqlite as sqlite };
