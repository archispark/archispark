/**
 * Demo organizations + memberships — the reusable core of
 * `packages/db/scripts/seed-demo.ts`'s organization-provisioning step,
 * ported to Drizzle so it can be shared by the CLI script and the demo
 * reset cron. `resolveUserId` is the abstraction point that lets the same
 * code serve both the Keycloak path (`findUserByUsername`) and the local
 * path (`findLocalUserIdByUsername`).
 */

import { and, eq, notExists, notInArray } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { organizations, organizationMembers, workspaces } from "./schema.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface DemoOrg {
  slug: string
  name: string
  workspaces: string[]
  members: Record<string, string>
}

export interface DemoOrgsFile {
  organizations: DemoOrg[]
  legacySlugs?: string[]
}

async function getOrCreateOrganization(
  database: Db,
  slug: string,
  name: string
): Promise<number> {
  const [row] = await database
    .insert(organizations)
    .values({ slug, name, isPersonal: false, enabled: true })
    .onConflictDoUpdate({ target: organizations.slug, set: { name } })
    .returning({ id: organizations.id })
  return row!.id
}

async function upsertMember(
  database: Db,
  organizationId: number,
  userId: string,
  role: string
): Promise<void> {
  await database
    .insert(organizationMembers)
    .values({ organizationId, userId, role })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role },
    })
}

async function removeStaleMembers(
  database: Db,
  organizationId: number,
  keepUserIds: string[]
): Promise<void> {
  await database
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        notInArray(organizationMembers.userId, keepUserIds)
      )
    )
}

/**
 * Deletes any organization matching a retired slug, but only if it now
 * holds zero workspaces — see `packages/db/seeds/demo-orgs.json`'s
 * `legacySlugs` doc comment for the self-healing rationale.
 */
async function cleanupLegacyOrganizations(
  database: Db,
  slugs: string[]
): Promise<void> {
  for (const slug of slugs) {
    await database
      .delete(organizations)
      .where(
        and(
          eq(organizations.slug, slug),
          notExists(
            database
              .select({ id: workspaces.id })
              .from(workspaces)
              .where(eq(workspaces.organizationId, organizations.id))
          )
        )
      )
  }
}

export async function seedDemoOrganizations(
  config: DemoOrgsFile,
  resolveUserId: (username: string) => Promise<string>,
  database: Db = defaultDb
): Promise<Map<string, number>> {
  const orgIdByWorkspace = new Map<string, number>()

  for (const org of config.organizations) {
    const orgId = await getOrCreateOrganization(database, org.slug, org.name)
    for (const workspace of org.workspaces) {
      orgIdByWorkspace.set(workspace, orgId)
    }

    const userIds = new Map<string, string>()
    for (const username of Object.keys(org.members)) {
      userIds.set(username, await resolveUserId(username))
    }
    for (const [username, role] of Object.entries(org.members)) {
      await upsertMember(database, orgId, userIds.get(username)!, role)
    }
    await removeStaleMembers(database, orgId, [...userIds.values()])
  }

  await cleanupLegacyOrganizations(database, config.legacySlugs ?? [])

  return orgIdByWorkspace
}
