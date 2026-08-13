/**
 * Demo Keycloak users seed — creates/updates the demo accounts (admin, user,
 * contrib, archi) via the Keycloak Admin API from
 * .docker/keycloak/demo-users.json.
 *
 * Unlike .docker/keycloak/realm-export.json (consumed by `--import-realm` at
 * Keycloak container first-boot, local dev only), this works against any
 * Keycloak realm — including a client's dedicated realm — and is idempotent
 * (safe to re-run; updates the password/role mappings of existing users).
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo-users
 *
 * Requires KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 * KEYCLOAK_ADMIN_CLIENT_SECRET (the api service account, with
 * manage-users/view-users on the target realm).
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import { seedKeycloakUsers, type SeedUser } from "./lib/seed-keycloak-users.js"

const USERS_PATH = resolve(
  import.meta.dirname,
  "../../../.docker/keycloak/demo-users.json"
)
const users = JSON.parse(readFileSync(USERS_PATH, "utf-8")) as SeedUser[]

await seedKeycloakUsers(users)
