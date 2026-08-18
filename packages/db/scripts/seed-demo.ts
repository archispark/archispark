/**
 * Demo seed script — loads the ArchiSurance and ArchiMetal workspaces into
 * the DB, grouped into the demo organization (packages/db/seeds/demo-orgs.json):
 * "Archi" (ArchiSurance + ArchiMetal), owned by "archi" with "contrib"/
 * "user" as editor/viewer. "admin" (the platform_admin demo account) is
 * deliberately never a member of it — demonstrates platform/organization
 * isolation from the demo itself.
 *
 * Membership is authoritative, not additive: for each organization, any
 * `organization_members` row for a user not listed in `demo-orgs.json` is
 * removed — so narrowing an organization's `members` (e.g. dropping a demo
 * user's access) takes effect on rerun instead of leaving stale rows
 * behind. Stale `user_active_organization` rows self-heal automatically on
 * the affected user's next request (`resolveActiveOrganizationId` in
 * `apps/server/lib/archimate/access.ts` falls back to another organization
 * they're still a member of).
 *
 * Self-healing legacy cleanup: `demo-orgs.json`'s `legacySlugs` lists slugs
 * retired by a past org restructuring (e.g. the `archisurance`/`archimetal`
 * → `archi` regroup, and the later retirement of the standalone `open`
 * organization). Each run deletes any organization matching one of those
 * slugs, but only if it now holds zero workspaces. When retiring/renaming a
 * slug in `organizations`, add the old slug to `legacySlugs` so future runs
 * clean it up automatically.
 *
 * Demo usernames (admin/user/contrib/archi) are resolved to a user id
 * either via Keycloak or via the local `users` table, depending on
 * `KEYCLOAK_SSO_ENABLED` (see `@workspace/auth`'s `isKeycloakSsoEnabled()`)
 * — run `seed:demo-users` (Keycloak) or `seed:local-demo-users` (local,
 * the default) first. See `../src/seed-demo-data.ts` and
 * `../src/seed-demo-organizations.ts` for the reusable core, also invoked
 * (via `pnpm run seed`) by the `seed-demo.yml` GitHub Actions workflow.
 *
 * Also (re)sets the login page message with the demo credentials
 * (`../src/seed-site-settings.ts`) — `site_settings` is an application
 * table like any other, so the reset flow's `TRUNCATE` wipes it too.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Requires DATABASE_URL, plus either the Keycloak Admin API env vars or a
 * populated local `users` table, depending on KEYCLOAK_SSO_ENABLED.
 *
 * Destructive reset: replaces the ArchiSurance/ArchiMetal workspaces'
 * content. Safe to run multiple times.
 */

import "@workspace/env/register"
import { isKeycloakSsoEnabled, findUserByUsername } from "@workspace/auth"
import { findLocalUserIdByUsername } from "../src/local-users.js"
import { seedDemoWorkspaces } from "../src/seed-demo-data.js"
import { seedDemoLoginMessage } from "../src/seed-site-settings.js"

async function resolveViaKeycloak(username: string): Promise<string> {
  const user = await findUserByUsername(username)
  if (!user?.id) {
    console.error(
      `Error: demo user "${username}" not found in Keycloak. Run \`pnpm --filter @workspace/db seed:demo-users\` first.`
    )
    process.exit(1)
  }
  console.log(`Resolved user: ${user.id} (${username})`)
  return user.id
}

async function resolveViaLocalAccounts(username: string): Promise<string> {
  const id = await findLocalUserIdByUsername(username)
  if (!id) {
    console.error(
      `Error: demo user "${username}" not found locally. Run \`pnpm --filter @workspace/db seed:local-demo-users\` first.`
    )
    process.exit(1)
  }
  console.log(`Resolved user: ${id} (${username})`)
  return id
}

const resolveUserId = isKeycloakSsoEnabled()
  ? resolveViaKeycloak
  : resolveViaLocalAccounts

console.log("Seeding workspaces (elements, views)…")
const { orgIdByWorkspace } = await seedDemoWorkspaces(resolveUserId)
for (const [workspace, orgId] of orgIdByWorkspace) {
  console.log(`Workspace "${workspace}" → organization id ${orgId}`)
}

console.log("Setting login page message…")
await seedDemoLoginMessage()

console.log("Done.")
process.exit(0)
