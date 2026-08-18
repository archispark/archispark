/**
 * Creates/updates the demo accounts, choosing Keycloak or the local `users`
 * table depending on `KEYCLOAK_SSO_ENABLED` (see `@workspace/auth`'s
 * `isKeycloakSsoEnabled()`) — lets the root `seed` composite script work
 * under either auth mode without hardcoding one.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:accounts
 */

import "@workspace/env/register"
import { spawnSync } from "child_process"
import { isKeycloakSsoEnabled } from "@workspace/auth"

const scripts = isKeycloakSsoEnabled()
  ? ["setup-realm.ts", "seed-demo-users.ts"]
  : ["seed-local-demo-users.ts"]

for (const script of scripts) {
  const result = spawnSync("tsx", [`scripts/${script}`], {
    stdio: "inherit",
    cwd: new URL("..", import.meta.url).pathname,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
