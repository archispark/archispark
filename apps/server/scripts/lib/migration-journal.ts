/**
 * Shared helpers for icon-pack generator scripts (generate-archimate-icon-pack.ts,
 * generate-cloud-icon-packs.ts) that need to append an incremental migration
 * to packages/db/drizzle-pg/ without rewriting an already-applied seed file.
 */

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

function journalFile(migrationsDir: string): string {
  return path.join(migrationsDir, "meta/_journal.json")
}

function readJournal(migrationsDir: string): { entries: JournalEntry[] } {
  return JSON.parse(readFileSync(journalFile(migrationsDir), "utf8")) as {
    entries: JournalEntry[]
  }
}

/** Next migration file path for `tagPrefix`, numbered after the last journal entry. */
export function nextMigrationFile(
  migrationsDir: string,
  tagPrefix: string
): { file: string; tag: string; idx: number } {
  const idx =
    Math.max(...readJournal(migrationsDir).entries.map((e) => e.idx)) + 1
  const tag = `${String(idx).padStart(4, "0")}_${tagPrefix}`
  return { file: path.join(migrationsDir, `${tag}.sql`), tag, idx }
}

/**
 * drizzle-orm's node-postgres migrator applies every journal entry whose
 * `when` is greater than the single latest-applied migration's created_at
 * (see PgDialect.migrate) — it does not track applied migrations
 * individually by hash/idx. `Date.now()` would silently make a new
 * migration a no-op forever on any already-migrated database whose last
 * entry's `when` (several of which are hand-set ahead of real time) is
 * larger, so keep `when` monotonically increasing from the journal itself
 * instead of trusting the wall clock.
 */
export function appendJournalEntry(
  migrationsDir: string,
  idx: number,
  tag: string
): void {
  const journal = readJournal(migrationsDir)
  const when = Math.max(...journal.entries.map((e) => e.when)) + 100000
  journal.entries.push({ idx, version: "7", when, tag, breakpoints: true })
  writeFileSync(
    journalFile(migrationsDir),
    JSON.stringify(journal, null, 2) + "\n"
  )
}
