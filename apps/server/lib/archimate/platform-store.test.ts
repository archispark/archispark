import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { db, organizations } from "@workspace/db"
import {
  listAllOrganizations,
  createOrganization,
  getPlatformOrganization,
  updatePlatformOrganization,
  deleteOrganizationAsPlatformAdmin,
} from "./platform-store"
import { NotFoundError } from "./errors"

let orgId: number

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({
      slug: `platform-store-test-${randomUUID()}`,
      name: "Platform Store Test",
    })
    .returning()
  orgId = org!.id
})

describe("platform-store", () => {
  it("creates a team organization with a slug derived from its name", async () => {
    const created = await createOrganization({
      name: `Créée ${randomUUID()}`,
      description: "A description",
    })
    expect(created.name).toMatch(/^Créée /)
    expect(created.description).toBe("A description")
    expect(created.is_personal).toBe(false)
    expect(created.enabled).toBe(true)
    expect(created.slug).toMatch(/^cr-e-/)
  })

  it("creates an organization with a null description when omitted", async () => {
    const created = await createOrganization({
      name: `No Desc ${randomUUID()}`,
    })
    expect(created.description).toBeNull()
  })

  it("assigns distinct slugs to organizations sharing the same name", async () => {
    const name = `Duplicate Name ${randomUUID()}`
    const first = await createOrganization({ name })
    const second = await createOrganization({ name })
    expect(first.slug).not.toBe(second.slug)
  })

  it("lists organizations with metadata only (no workspace content)", async () => {
    const list = await listAllOrganizations()
    const found = list.find((o) => o.id === String(orgId))
    expect(found).toBeDefined()
    expect(found).not.toHaveProperty("workspaces")
  })

  it("suspends and reactivates an organization", async () => {
    const suspended = await updatePlatformOrganization(orgId, {
      enabled: false,
    })
    expect(suspended.enabled).toBe(false)
    const reactivated = await updatePlatformOrganization(orgId, {
      enabled: true,
    })
    expect(reactivated.enabled).toBe(true)
  })

  it("updates name and description, leaving other fields untouched", async () => {
    const updated = await updatePlatformOrganization(orgId, {
      name: "Renamed Org",
      description: "A description",
    })
    expect(updated.name).toBe("Renamed Org")
    expect(updated.description).toBe("A description")
    expect(updated.enabled).toBe(true)
  })

  it("returns organization details with its members", async () => {
    const detail = await getPlatformOrganization(orgId)
    expect(detail.id).toBe(String(orgId))
    expect(detail.members).toEqual([])
  })

  it("throws NotFoundError for an unknown organization id", async () => {
    await expect(
      updatePlatformOrganization(999999, { enabled: false })
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(getPlatformOrganization(999999)).rejects.toBeInstanceOf(
      NotFoundError
    )
    await expect(
      deleteOrganizationAsPlatformAdmin(999999)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("deletes an organization", async () => {
    await deleteOrganizationAsPlatformAdmin(orgId)
    const list = await listAllOrganizations()
    expect(list.some((o) => o.id === String(orgId))).toBe(false)
  })
})
