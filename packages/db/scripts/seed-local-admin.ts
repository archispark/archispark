/**
 * Local-auth admin seed — creates/updates a single admin account directly
 * in the `users` table (id `local:<uuid>`). Idempotent (safe to re-run):
 * re-running updates the password/email/role of the existing row instead
 * of erroring. Reusable core in `../src/local-users.ts` (also used by
 * `seed-local-demo-users.ts` and the demo reset cron).
 *
 * A fresh install no longer needs this: migration
 * `0025_seed_local_admin.sql` creates the same `admin`/`admin` account the
 * first time it runs against an empty `users` table. This script is for
 * re-seeding on demand — after `pnpm --filter @workspace/db reset` (which
 * wipes `users`, so the migration won't fire again — it only ever runs
 * once), or to recover a locked-out account.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:local-admin
 *
 * Requires DATABASE_URL.
 */

import "@workspace/env/register"
import { readFileSync } from "fs"
import { resolve } from "path"
import { seedLocalUsers, type LocalSeedUser } from "../src/local-users.js"

const USERS_PATH = resolve(
  import.meta.dirname,
  "../../../.docker/local-auth/admin-user.json"
)
const seedUsers = JSON.parse(readFileSync(USERS_PATH, "utf-8")) as LocalSeedUser[]

const results = await seedLocalUsers(seedUsers)
for (const { username, id, created } of results) {
  console.log(`${created ? "Created" : "Updated"} user ${username} (${id})`)
}
console.log("Done.")
process.exit(0)
