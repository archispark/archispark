import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { db, organizations } from "@workspace/db"
import {
  listAllOrganizations,
  setOrganizationEnabled,
  deleteOrganizationAsPlatformAdmin,
} from "./platform-store.js"
import { NotFoundError } from "./errors.js"

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
  it("lists organizations with metadata only (no workspace content)", async () => {
    const list = await listAllOrganizations()
    const found = list.find((o) => o.id === String(orgId))
    expect(found).toBeDefined()
    expect(found).not.toHaveProperty("workspaces")
  })

  it("suspends and reactivates an organization", async () => {
    const suspended = await setOrganizationEnabled(orgId, false)
    expect(suspended.enabled).toBe(false)
    const reactivated = await setOrganizationEnabled(orgId, true)
    expect(reactivated.enabled).toBe(true)
  })

  it("throws NotFoundError for an unknown organization id", async () => {
    await expect(setOrganizationEnabled(999999, false)).rejects.toBeInstanceOf(
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
