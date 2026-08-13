/**
 * Local-auth admin seed — creates/updates a single admin account directly
 * in the `users` table (id `local:<uuid>`). Idempotent (safe to re-run):
 * re-running updates the password/email/role of the existing row instead
 * of erroring.
 *
 * A fresh install no longer needs this: migration
 * `0025_seed_local_admin.sql` creates the same `admin`/`admin` account the
 * first time it runs against an empty `users` table. This script is for
 * re-seeding on demand — after `pnpm db:reset` (which wipes `users`, so the
 * migration won't fire again — it only ever runs once), or to recover a
 * locked-out account.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:local-admin
 *
 * Requires DATABASE_URL. Uses a raw `pg` client (not the Drizzle singleton)
 * so the script can close its own connection and exit — matching
 * reset.ts/seed-dashboards.ts.
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import { randomUUID } from "crypto"
import pg from "pg"
import { hashPassword } from "@workspace/auth"

interface SeedUser {
  username: string
  email: string
  password: string
  displayName?: string
  role?: string
}

const USERS_PATH = resolve(
  import.meta.dirname,
  "../../../.docker/local-auth/admin-user.json"
)
const seedUsers = JSON.parse(readFileSync(USERS_PATH, "utf-8")) as SeedUser[]

const dbUrl = process.env["DATABASE_URL"]
if (!dbUrl) {
  console.error("Missing DATABASE_URL.")
  process.exit(1)
}

function isLocal(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(url)
}

function stripSslmode(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    url.searchParams.delete("sslmode")
    return url.toString()
  } catch {
    return connectionString
  }
}

const local = isLocal(dbUrl)
const client = new pg.Client({
  connectionString: local ? dbUrl : stripSslmode(dbUrl),
  ssl: local ? undefined : { rejectUnauthorized: false },
})
await client.connect()

for (const u of seedUsers) {
  const username = u.username.trim().toLowerCase()
  const email = u.email.trim().toLowerCase()
  const passwordHash = await hashPassword(u.password)
  const role = u.role ?? "user"

  const { rows } = await client.query(
    `insert into users (id, username, email, password_hash, display_name, role, enabled, email_verified)
     values ($1, $2, $3, $4, $5, $6, true, true)
     on conflict (username) do update set
       email = excluded.email,
       password_hash = excluded.password_hash,
       display_name = excluded.display_name,
       role = excluded.role
     returning id, (xmax = 0) as inserted`,
    [
      `local:${randomUUID()}`,
      username,
      email,
      passwordHash,
      u.displayName ?? null,
      role,
    ]
  )
  const row = rows[0] as { id: string; inserted: boolean }
  console.log(
    `${row.inserted ? "Created" : "Updated"} user ${username} (${row.id})`
  )
}

await client.end()
console.log("Done.")
