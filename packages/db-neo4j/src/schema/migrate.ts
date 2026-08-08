import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getDriver } from "../connection.js";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export function migrationVersion(filename: string): string {
  const version = filename.split("_")[0];
  if (!version) throw new Error(`Nom de fichier de migration invalide : ${filename}`);
  return version;
}

export function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".cypher"))
    .sort();
}

/** Applies every migration under schema/migrations/ not yet recorded as a :SchemaMigration node, in filename order. */
export async function runNeo4jMigrations(): Promise<void> {
  const session = getDriver().session();
  try {
    for (const file of listMigrationFiles()) {
      const version = migrationVersion(file);
      const check = await session.run("MATCH (sm:SchemaMigration {version: $version}) RETURN sm", { version });
      if (check.records.length > 0) continue;

      const statements = readFileSync(join(MIGRATIONS_DIR, file), "utf-8")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const statement of statements) await session.run(statement);

      await session.run(
        "MERGE (sm:SchemaMigration {version: $version}) SET sm.name = $file, sm.appliedAt = datetime()",
        { version, file },
      );
    }
  } finally {
    await session.close();
  }
}

let schemaEnsured = false;

/** Runs pending migrations once per process — memoized so repeat calls after the first don't pay a round trip. */
export async function ensureNeo4jSchema(): Promise<void> {
  if (schemaEnsured) return;
  await runNeo4jMigrations();
  schemaEnsured = true;
}
