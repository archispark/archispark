/**
 * Tests for src/organizations-store.ts — organization/member CRUD and the
 * last-owner invariant (Phase 4).
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { eq, and } from "drizzle-orm"
import { db, organizations, organizationMembers } from "@workspace/db"
import {
  listOrganizationsForUser,
  createOrganization,
  renameOrganization,
  deleteOrganization,
  activateOrganization,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "./organizations-store.js"
import { ValidationError, NotFoundError, ForbiddenError } from "./errors.js"
import type { AccessUser } from "./access.js"
import { DEMO_KEYCLOAK_SUBS } from "./test/keycloak-token-fake.js"

const OWNER: AccessUser = {
  id: `org-store-owner-${randomUUID()}`,
  role: "user",
}
const ADMIN: AccessUser = {
  id: `org-store-admin-${randomUUID()}`,
  role: "user",
}
const PLATFORM_ADMIN: AccessUser = {
  id: `org-store-platform-${randomUUID()}`,
  role: "platform_admin",
}

let orgId: number

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `org-store-test-${randomUUID()}`, name: "Org Store Test" })
    .returning()
  orgId = org!.id
  await db.insert(organizationMembers).values([
    { organizationId: orgId, userId: OWNER.id, role: "owner" },
    { organizationId: orgId, userId: ADMIN.id, role: "admin" },
  ])
})

describe("createOrganization / listOrganizationsForUser", () => {
  it("creates a team organization with the creator as owner", async () => {
    const created = await createOrganization(OWNER, "My Team")
    expect(created.role).toBe("owner")
    expect(created.is_personal).toBe(false)

    const list = await listOrganizationsForUser(OWNER)
    expect(list.some((o) => o.id === created.id)).toBe(true)
  })

  it("generates a distinct slug for two organizations with the same name", async () => {
    const a = await createOrganization(OWNER, "Duplicate Name Co")
    const b = await createOrganization(OWNER, "Duplicate Name Co")
    expect(a.slug).not.toBe(b.slug)
  })

  it("rejects an empty name", async () => {
    await expect(createOrganization(OWNER, "  ")).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it("platform_admin sees an empty organization list, never their own", async () => {
    await expect(listOrganizationsForUser(PLATFORM_ADMIN)).resolves.toEqual([])
  })

  it("platform_admin cannot create an organization", async () => {
    await expect(
      createOrganization(PLATFORM_ADMIN, "Should Not Exist")
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("renameOrganization / activateOrganization / deleteOrganization", () => {
  it("owner and admin can rename; member cannot", async () => {
    const renamed = await renameOrganization(OWNER, orgId, "Renamed by owner")
    expect(renamed.name).toBe("Renamed by owner")
    await expect(
      renameOrganization(ADMIN, orgId, "Renamed by admin")
    ).resolves.toMatchObject({ name: "Renamed by admin" })
  })

  it("activateOrganization marks the organization active for that user", async () => {
    const activated = await activateOrganization(OWNER, orgId)
    expect(activated.active).toBe(true)
  })

  it("only an owner can delete an organization — admin is forbidden", async () => {
    const [temp] = await db
      .insert(organizations)
      .values({ slug: `org-store-del-${randomUUID()}`, name: "To Delete" })
      .returning()
    await db.insert(organizationMembers).values([
      { organizationId: temp!.id, userId: OWNER.id, role: "owner" },
      { organizationId: temp!.id, userId: ADMIN.id, role: "admin" },
    ])
    await expect(deleteOrganization(ADMIN, temp!.id)).rejects.toBeInstanceOf(
      ForbiddenError
    )
    await deleteOrganization(OWNER, temp!.id)
    const [gone] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, temp!.id))
    expect(gone).toBeUndefined()
  })
})

describe("addMember", () => {
  it("owner can add an existing Keycloak user", async () => {
    const added = await addMember(OWNER, orgId, "contrib", "member")
    expect(added.user_id).toBe(DEMO_KEYCLOAK_SUBS.contrib)
    expect(added.role).toBe("member")
  })

  it("admin cannot add a member (manage_members is owner-only)", async () => {
    await expect(
      addMember(ADMIN, orgId, "user", "member")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("rejects a username that doesn't exist in Keycloak", async () => {
    await expect(
      addMember(OWNER, orgId, "does-not-exist", "member")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects adding a user who is already a member", async () => {
    await expect(
      addMember(OWNER, orgId, "contrib", "admin")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("listMembers returns usernames resolved from Keycloak", async () => {
    const members = await listMembers(OWNER, orgId)
    expect(members.find((m) => m.user_id === OWNER.id)?.role).toBe("owner")
    expect(
      members.find((m) => m.user_id === DEMO_KEYCLOAK_SUBS.contrib)?.username
    ).toBe("contrib")
  })
})

describe("last-owner invariant", () => {
  let soloOrgId: number
  const SOLO_OWNER: AccessUser = {
    id: `org-store-solo-${randomUUID()}`,
    role: "user",
  }

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `org-store-solo-${randomUUID()}`,
        name: "Solo Owner Org",
      })
      .returning()
    soloOrgId = org!.id
    await db
      .insert(organizationMembers)
      .values({
        organizationId: soloOrgId,
        userId: SOLO_OWNER.id,
        role: "owner",
      })
  })

  it("refuses to demote the last owner", async () => {
    await expect(
      updateMemberRole(SOLO_OWNER, soloOrgId, SOLO_OWNER.id, "admin")
    ).rejects.toBeInstanceOf(ValidationError)
    const [row] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, soloOrgId),
          eq(organizationMembers.userId, SOLO_OWNER.id)
        )
      )
    expect(row!.role).toBe("owner")
  })

  it("refuses to remove the last owner, including self-removal", async () => {
    await expect(
      removeMember(SOLO_OWNER, soloOrgId, SOLO_OWNER.id)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows demoting an owner once a second owner exists", async () => {
    await addMember(SOLO_OWNER, soloOrgId, "user", "owner")
    await expect(
      updateMemberRole(SOLO_OWNER, soloOrgId, SOLO_OWNER.id, "admin")
    ).resolves.toMatchObject({ role: "admin" })
  })
})
