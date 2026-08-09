/**
 * Remove all ArchiSpark application data while preserving PostgreSQL schema and
 * Drizzle migration history. Keycloak uses a separate database and is not
 * touched.
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm --filter @workspace/db reset
 */

import pg from "pg"

const dbUrl = process.env["DATABASE_URL"]
if (!dbUrl) {
  console.error("Missing DATABASE_URL.")
  process.exit(1)
}

const isLocal = (url: string) =>
  /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(url)

function stripSslmode(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    url.searchParams.delete("sslmode")
    return url.toString()
  } catch {
    return connectionString
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

const local = isLocal(dbUrl)
const client = new pg.Client({
  connectionString: local ? dbUrl : stripSslmode(dbUrl),
  ssl: local ? undefined : { rejectUnauthorized: false },
})

await client.connect()

try {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name <> '__drizzle_migrations'
     ORDER BY table_name`
  )

  if (rows.length === 0) {
    console.log("No application tables to reset.")
  } else {
    const tables = rows
      .map(({ table_name }) => quoteIdentifier(table_name))
      .join(", ")
    await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)
    console.log(`Reset ${rows.length} application table(s).`)
  }
} finally {
  await client.end()
}
