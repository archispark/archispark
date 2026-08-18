/**
 * Local-accounts seeding — the reusable core behind
 * `packages/db/scripts/seed-local-admin.ts` (single admin) and the
 * `seed-demo.yml` GitHub Actions workflow, which both need to upsert one or
 * more `local:<uuid>` accounts without going through Keycloak.
 */

import { randomUUID } from "crypto"
import { eq, sql } from "drizzle-orm"
import { hashPassword } from "@workspace/auth"
import { db as defaultDb } from "./connection.js"
import { users } from "./schema.js"

// `any` matches the rest of the codebase's transaction-callback convention
// (see organizations.ts) — a Drizzle transaction handle (`tx`) is
// structurally compatible with `db` but has a distinct generated type per
// call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface LocalSeedUser {
  username: string
  email: string
  password: string
  displayName?: string
  role?: string
}

export interface SeededLocalUser {
  username: string
  id: string
  created: boolean
}

/**
 * Idempotent upsert-by-username, matching `seed-local-admin.ts`'s raw-SQL
 * behavior: an existing account gets its email/password/displayName/role
 * updated, a new one is created with a fresh `local:<uuid>` id.
 */
export async function seedLocalUsers(
  seedUsers: LocalSeedUser[],
  database: Db = defaultDb
): Promise<SeededLocalUser[]> {
  const results: SeededLocalUser[] = []
  for (const seedUser of seedUsers) {
    const username = seedUser.username.trim().toLowerCase()
    const email = seedUser.email.trim().toLowerCase()
    const passwordHash = await hashPassword(seedUser.password)
    const displayName = seedUser.displayName ?? null
    const role = seedUser.role ?? "user"

    const [row] = await database
      .insert(users)
      .values({
        id: `local:${randomUUID()}`,
        username,
        email,
        passwordHash,
        displayName,
        role,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { email, passwordHash, displayName, role },
      })
      .returning({ id: users.id, inserted: sql<boolean>`(xmax = 0)` })

    results.push({ username, id: row!.id, created: row!.inserted })
  }
  return results
}

/** Local-accounts equivalent of `@workspace/auth`'s Keycloak-only `findUserByUsername`. */
export async function findLocalUserIdByUsername(
  username: string,
  database: Db = defaultDb
): Promise<string | null> {
  const [row] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase()))
  return row?.id ?? null
}
