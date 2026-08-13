/**
 * Tests for migration 0026_org_roles_owner_editor_viewer.sql — renaming
 * stored organization role values "admin" -> "editor", "member" -> "viewer".
 * The migration's UPDATE statements are idempotent (no NOT EXISTS guard), so
 * this test seeds legacy-named rows post-migration and re-executes the same
 * statements directly to verify the rename logic, independent of whether
 * this particular test run ever had pre-0026 data to migrate.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import {
  organizations,
  organizationMembers,
  organizationInvitations,
} from "./schema.js"

beforeAll(async () => {
  await runMigrations()
})

async function renameLegacyRoles(): Promise<void> {
  await db.execute(
    sql`UPDATE "organization_members" SET "role" = 'editor' WHERE "role" = 'admin'`
  )
  await db.execute(
    sql`UPDATE "organization_members" SET "role" = 'viewer' WHERE "role" = 'member'`
  )
  await db.execute(
    sql`UPDATE "organization_invitations" SET "role" = 'editor' WHERE "role" = 'admin'`
  )
  await db.execute(
    sql`UPDATE "organization_invitations" SET "role" = 'viewer' WHERE "role" = 'member'`
  )
}

describe("0026_org_roles_owner_editor_viewer", () => {
  it("renames legacy admin/member role values to editor/viewer", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `role-rename-${randomUUID()}`, name: "Role Rename" })
      .returning({ id: organizations.id })
    const organizationId = org!.id

    const ownerId = `role-rename-owner-${randomUUID()}`
    const adminId = `role-rename-admin-${randomUUID()}`
    const memberId = `role-rename-member-${randomUUID()}`
    await db.insert(organizationMembers).values([
      { organizationId, userId: ownerId, role: "owner" },
      { organizationId, userId: adminId, role: "admin" },
      { organizationId, userId: memberId, role: "member" },
    ])
    await db.insert(organizationInvitations).values([
      {
        organizationId,
        email: "invitee-admin@example.com",
        role: "admin",
        tokenHash: `hash-${randomUUID()}`,
        invitedByUserId: ownerId,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
      {
        organizationId,
        email: "invitee-member@example.com",
        role: "member",
        tokenHash: `hash-${randomUUID()}`,
        invitedByUserId: ownerId,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    ])

    await renameLegacyRoles()

    const members = await db
      .select({ userId: organizationMembers.userId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId))
    expect(members.find((m) => m.userId === ownerId)?.role).toBe("owner")
    expect(members.find((m) => m.userId === adminId)?.role).toBe("editor")
    expect(members.find((m) => m.userId === memberId)?.role).toBe("viewer")

    const invitations = await db
      .select({ email: organizationInvitations.email, role: organizationInvitations.role })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, organizationId))
    expect(
      invitations.find((i) => i.email === "invitee-admin@example.com")?.role
    ).toBe("editor")
    expect(
      invitations.find((i) => i.email === "invitee-member@example.com")?.role
    ).toBe("viewer")
  })

  it("is a no-op when no legacy role values remain", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `role-rename-noop-${randomUUID()}`, name: "Role Rename Noop" })
      .returning({ id: organizations.id })
    const organizationId = org!.id
    const userId = `role-rename-noop-${randomUUID()}`
    await db
      .insert(organizationMembers)
      .values({ organizationId, userId, role: "editor" })

    await renameLegacyRoles()

    const [member] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
    expect(member!.role).toBe("editor")
  })
})
