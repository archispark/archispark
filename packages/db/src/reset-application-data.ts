/**
 * Wipes every application table (all data), preserving the PostgreSQL
 * schema and Drizzle's own migration history (`__drizzle_migrations`) —
 * the reusable core behind `packages/db/scripts/reset.ts`, also used by the
 * `seed-demo.yml` GitHub Actions workflow, which needs a full
 * fresh-reinstall-style wipe rather than a scoped delete since the public
 * demo lets visitors create their own accounts/organizations.
 */

import { sql } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

export interface TruncateResult {
  tables: number
}

export async function truncateApplicationTables(
  database: Db = defaultDb
): Promise<TruncateResult> {
  const { rows } = await database.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '__drizzle_migrations'
    ORDER BY table_name
  `)

  if (rows.length === 0) return { tables: 0 }

  const tableList = rows
    .map((row: { table_name: string }) => quoteIdentifier(row.table_name))
    .join(", ")
  await database.execute(
    sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
  )
  return { tables: rows.length }
}
