/**
 * Minimal Keycloak seed — creates/updates a single admin account
 * (`platform_admin`) via the Keycloak Admin API from
 * .docker/keycloak/minimal-users.json, so a fresh install has a working
 * login without the full demo dataset (organizations, workspaces,
 * ArchiMate models).
 *
 * No organization or workspace is seeded: the first user's personal
 * organization is created automatically on their first workspace (see
 * `getOrCreatePersonalOrganization` in `@workspace/db`).
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:minimal-users
 *
 * Requires KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 * KEYCLOAK_ADMIN_CLIENT_SECRET (the api service account, with
 * manage-users/view-users on the target realm).
 */

import "@workspace/env/register"
import { readFileSync } from "fs"
import { resolve } from "path"
import { seedKeycloakUsers, type SeedUser } from "./lib/seed-keycloak-users.js"

const USERS_PATH = resolve(
  import.meta.dirname,
  "../../../.docker/keycloak/minimal-users.json"
)
const users = JSON.parse(readFileSync(USERS_PATH, "utf-8")) as SeedUser[]

await seedKeycloakUsers(users)
