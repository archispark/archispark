import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "node:crypto"
import { eq, isNull, and } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import {
  workspaces,
  apiTokens,
  organizations,
  organizationMembers,
} from "./schema.js"
import { runOrganizationBackfill } from "./backfill-organizations.js"

beforeAll(async () => {
  await runMigrations()
})

async function insertLegacyWorkspace(
  userId: string,
  name: string
): Promise<number> {
  const [ws] = await db
    .insert(workspaces)
    .values({
      uuid: `id-${randomUUID()}`,
      name,
      createdById: userId,
      organizationId: null,
    })
    .returning({ id: workspaces.id })
  return ws!.id
}

describe("runOrganizationBackfill", () => {
  it("creates a personal organization per distinct user and attaches their workspaces", async () => {
    const userA = `backfill-user-a-${randomUUID()}`
    const userB = `backfill-user-b-${randomUUID()}`

    // Both users have a workspace with the SAME name — this must NOT collide
    // once scoped by (organization_id, name) instead of the old (owner_id, name).
    const wsA = await insertLegacyWorkspace(userA, "Shared Name")
    const wsB = await insertLegacyWorkspace(userB, "Shared Name")

    await runOrganizationBackfill()

    const [rowA] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsA))
    const [rowB] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsB))
    expect(rowA!.organizationId).not.toBeNull()
    expect(rowB!.organizationId).not.toBeNull()
    expect(rowA!.organizationId).not.toBe(rowB!.organizationId)

    const [orgA] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, rowA!.organizationId!))
    expect(orgA!.isPersonal).toBe(true)
    expect(orgA!.personalOwnerId).toBe(userA)

    const [memberA] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, rowA!.organizationId!),
          eq(organizationMembers.userId, userA)
        )
      )
    expect(memberA!.role).toBe("owner")
  })

  it("attaches orphaned api_tokens to the token owner's personal organization", async () => {
    const userC = `backfill-user-c-${randomUUID()}`
    const [token] = await db
      .insert(apiTokens)
      .values({
        token: randomUUID(),
        name: "legacy token",
        userId: userC,
        organizationId: null,
      })
      .returning({ id: apiTokens.id })

    await runOrganizationBackfill()

    const [row] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, token!.id))
    expect(row!.organizationId).not.toBeNull()

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.personalOwnerId, userC))
    expect(org!.id).toBe(row!.organizationId)
  })

  it("is idempotent: a second run changes nothing", async () => {
    const userD = `backfill-user-d-${randomUUID()}`
    await insertLegacyWorkspace(userD, "Idempotent Workspace")

    await runOrganizationBackfill()
    const [afterFirst] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.createdById, userD))
    const orgIdAfterFirst = afterFirst!.organizationId

    await runOrganizationBackfill()
    const [afterSecond] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.createdById, userD))
    expect(afterSecond!.organizationId).toBe(orgIdAfterFirst)

    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.personalOwnerId, userD))
    expect(orgs).toHaveLength(1)
  })

  it("leaves no workspace or api_token without an organization, and every organization has exactly one owner", async () => {
    const orphanWorkspaces = await db
      .select()
      .from(workspaces)
      .where(isNull(workspaces.organizationId))
    expect(orphanWorkspaces).toHaveLength(0)

    const orphanTokens = await db
      .select()
      .from(apiTokens)
      .where(isNull(apiTokens.organizationId))
    expect(orphanTokens).toHaveLength(0)

    const allOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
    for (const org of allOrgs) {
      const owners = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.role, "owner")
          )
        )
      expect(owners.length).toBeGreaterThanOrEqual(1)
    }
  })
})
