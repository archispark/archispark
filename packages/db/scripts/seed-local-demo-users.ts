/**
 * Local-auth demo users seed — creates/updates the 5 demo accounts
 * (admin/user/contrib/archi/open) directly in the `users` table from
 * `packages/db/seeds/local-demo-users.json`. Local-accounts equivalent of
 * `seed-demo-users.ts` (Keycloak), for the default no-Keycloak setup
 * (`KEYCLOAK_SSO_ENABLED` unset/false — see `@workspace/auth`'s
 * `isKeycloakSsoEnabled()`).
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:local-demo-users
 *
 * Requires DATABASE_URL.
 */

import "@workspace/env/register"
import { seedLocalDemoUsers } from "../src/local-demo-users.js"

const results = await seedLocalDemoUsers()
for (const { username, id, created } of results) {
  console.log(`${created ? "Created" : "Updated"} user ${username} (${id})`)
}
console.log("Done.")
process.exit(0)
