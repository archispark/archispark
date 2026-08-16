/**
 * Tests for platform-organization-members-store.ts — list/add/remove an
 * organization's members from the platform_admin organization detail page,
 * bypassing the regular owner-only assertOrgAccess gate.
 */

import { describe, it, expect } from "vitest"
import { randomUUID } from "crypto"
import { db, users, organizations } from "@workspace/db"
import {
  listOrganizationMembers,
  addOrganizationMember,
  removeOrganizationMember,
} from "./platform-organization-members-store"
import { NotFoundError, ValidationError } from "./errors"

async function insertUser() {
  const suffix = randomUUID()
  const [row] = await db
    .insert(users)
    .values({
      id: `local:${suffix}`,
      username: `platform-org-members-test-${suffix}`,
      email: `platform-org-members-test-${suffix}@example.com`,
      passwordHash: "irrelevant",
    })
    .returning()
  return row!
}

async function insertOrg() {
  const [row] = await db
    .insert(organizations)
    .values({
      slug: `platform-org-members-test-${randomUUID()}`,
      name: "Test Org",
    })
    .returning()
  return row!
}

describe("listOrganizationMembers", () => {
  it("returns an empty list for an organization without members", async () => {
    const org = await insertOrg()
    expect(await listOrganizationMembers(org.id)).toEqual([])
  })

  it("lists members with their role, ordered by username", async () => {
    const org = await insertOrg()
    const userA = await insertUser()
    const userB = await insertUser()
    await addOrganizationMember(org.id, userA.id, "owner")
    await addOrganizationMember(org.id, userB.id, "viewer")

    const members = await listOrganizationMembers(org.id)
    expect(members.map((m) => m.id).sort()).toEqual([userA.id, userB.id].sort())
    expect(members.find((m) => m.id === userA.id)?.role).toBe("owner")
    expect(members.find((m) => m.id === userB.id)?.role).toBe("viewer")
  })
})

describe("addOrganizationMember", () => {
  it("adds a membership with the given role", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    const result = await addOrganizationMember(org.id, user.id, "editor")
    expect(result).toEqual({
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.displayName,
      role: "editor",
    })
  })

  it("rejects an invalid role", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await expect(
      addOrganizationMember(org.id, user.id, "nope")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("throws NotFoundError for an unknown organization or user", async () => {
    const user = await insertUser()
    await expect(
      addOrganizationMember(999999999, user.id, "viewer")
    ).rejects.toBeInstanceOf(NotFoundError)

    const org = await insertOrg()
    await expect(
      addOrganizationMember(org.id, "local:does-not-exist", "viewer")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses to add an already-existing membership", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await addOrganizationMember(org.id, user.id, "viewer")
    await expect(
      addOrganizationMember(org.id, user.id, "editor")
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe("removeOrganizationMember", () => {
  it("removes an existing membership", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await addOrganizationMember(org.id, user.id, "editor")
    await removeOrganizationMember(org.id, user.id)
    expect(await listOrganizationMembers(org.id)).toEqual([])
  })

  it("throws NotFoundError when the membership doesn't exist", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await expect(
      removeOrganizationMember(org.id, user.id)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses to remove the last owner", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await addOrganizationMember(org.id, user.id, "owner")
    await expect(
      removeOrganizationMember(org.id, user.id)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows removing an owner when another owner remains", async () => {
    const userA = await insertUser()
    const userB = await insertUser()
    const org = await insertOrg()
    await addOrganizationMember(org.id, userA.id, "owner")
    await addOrganizationMember(org.id, userB.id, "owner")
    await expect(
      removeOrganizationMember(org.id, userA.id)
    ).resolves.toBeUndefined()
  })
})
