import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import * as schema from "./schema.js";

const DB_PATH = join(process.cwd(), "data", "archispark.db");

mkdirSync(join(process.cwd(), "data"), { recursive: true });
const sqlite: InstanceType<typeof Database> = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
