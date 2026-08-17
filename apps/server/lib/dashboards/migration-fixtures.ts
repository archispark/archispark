/**
 * Test-only helper: extracts a dashboard's JSON definition embedded in one
 * of ArchiSpark's hand-written backfill migrations
 * (packages/db/drizzle-pg/00NN_*.sql), so tests exercise the exact SQL text
 * that ships rather than a hand-copied duplicate that could drift.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/drizzle-pg"
)

export function readMigrationDefinition(
  fileName: string
): Record<string, unknown> {
  const text = readFileSync(join(MIGRATIONS_DIR, fileName), "utf8")
  const match = text.match(/\$def\$\n([\s\S]*?)\n\$def\$::jsonb/)
  if (!match)
    throw new Error(`No $def$ ... $def$::jsonb block found in ${fileName}`)
  return JSON.parse(match[1]!)
}

export function migrationPanelQuery(
  definition: Record<string, unknown>,
  panelId: string
) {
  const panels = definition["panels"] as Array<{
    id: string
    panel: { query: unknown }
  }>
  const instance = panels.find((p) => p.id === panelId)
  if (!instance) throw new Error(`Panel "${panelId}" not found`)
  return instance.panel.query as {
    datasourceId: string
    language: "sql" | "cypher"
    text: string
  }
}
