/**
 * Seeds the 5 demo local accounts (admin/user/contrib/archi/open) from
 * `packages/db/seeds/local-demo-users.json` — the local-accounts
 * equivalent of `packages/db/scripts/seed-demo-users.ts`'s Keycloak seed,
 * used by both `packages/db/scripts/seed-local-demo-users.ts` (CLI) and the
 * demo reset cron.
 */

import { readFileSync } from "fs"
import { seedsPath } from "./seeds-path.js"
import { seedLocalUsers, type LocalSeedUser, type SeededLocalUser } from "./local-users.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function seedLocalDemoUsers(
  database?: Db
): Promise<SeededLocalUser[]> {
  const seedUsers = JSON.parse(
    readFileSync(seedsPath("local-demo-users.json"), "utf-8")
  ) as LocalSeedUser[]
  return seedLocalUsers(seedUsers, database)
}
