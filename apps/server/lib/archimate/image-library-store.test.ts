import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { getOrCreatePersonalOrganization } from "@workspace/db"
import {
  listAccessibleImagePacks,
  createCustomImagePack,
  getOwnedCustomPack,
  getSystemInlineSvgItem,
} from "./image-library-store"
import { NotFoundError, ValidationError } from "./errors"

let orgId: number
let otherOrgId: number

beforeAll(async () => {
  orgId = await getOrCreatePersonalOrganization(
    `image-lib-store-owner-${randomUUID()}`
  )
  otherOrgId = await getOrCreatePersonalOrganization(
    `image-lib-store-other-${randomUUID()}`
  )
})

describe("createCustomImagePack / listAccessibleImagePacks", () => {
  it("creates a custom pack scoped to the organization", async () => {
    const pack = await createCustomImagePack(orgId, {
      name: "My Pack",
      slug: `my-pack-${randomUUID()}`,
    })
    expect(pack.name).toBe("My Pack")
    expect(pack.is_system).toBe(false)
    expect(pack.items).toEqual([])

    const packs = await listAccessibleImagePacks(orgId)
    expect(packs.some((p) => p.identifier === pack.identifier)).toBe(true)
  })

  it("rejects a duplicate slug within the same organization", async () => {
    const slug = `dup-pack-${randomUUID()}`
    await createCustomImagePack(orgId, { name: "First", slug })
    await expect(
      createCustomImagePack(orgId, { name: "Second", slug })
    ).rejects.toThrow(ValidationError)
  })

  it("does not list another organization's custom pack", async () => {
    const pack = await createCustomImagePack(otherOrgId, {
      name: "Other Org Pack",
      slug: `other-visible-${randomUUID()}`,
    })
    const packs = await listAccessibleImagePacks(orgId)
    expect(packs.some((p) => p.identifier === pack.identifier)).toBe(false)
  })

  it("includes the system pack for every organization", async () => {
    const packsA = await listAccessibleImagePacks(orgId)
    const packsB = await listAccessibleImagePacks(otherOrgId)
    const systemA = packsA.find((p) => p.is_system)
    const systemB = packsB.find((p) => p.is_system)
    expect(systemA).toBeDefined()
    expect(systemA?.identifier).toBe(systemB?.identifier)
    expect(systemA?.items.length).toBeGreaterThan(0)
  })
})

describe("getOwnedCustomPack", () => {
  it("returns the pack row when owned by the organization", async () => {
    const pack = await createCustomImagePack(orgId, {
      name: "Owned",
      slug: `owned-${randomUUID()}`,
    })
    const row = await getOwnedCustomPack(orgId, pack.identifier)
    expect(row.uuid).toBe(pack.identifier)
  })

  it("throws NotFoundError for a pack owned by another organization", async () => {
    const pack = await createCustomImagePack(otherOrgId, {
      name: "Not Mine",
      slug: `not-mine-${randomUUID()}`,
    })
    await expect(getOwnedCustomPack(orgId, pack.identifier)).rejects.toThrow(
      NotFoundError
    )
  })

  it("throws NotFoundError for an unknown pack uuid", async () => {
    await expect(getOwnedCustomPack(orgId, randomUUID())).rejects.toThrow(
      NotFoundError
    )
  })
})

describe("getSystemInlineSvgItem", () => {
  it("returns the svg content of a system pack item", async () => {
    const packs = await listAccessibleImagePacks(orgId)
    const systemItem = packs.find((p) => p.is_system)?.items[0]
    expect(systemItem).toBeDefined()
    const svg = await getSystemInlineSvgItem(systemItem!.identifier)
    expect(svg).toContain("<svg")
  })

  it("returns null for an unknown item", async () => {
    expect(await getSystemInlineSvgItem(randomUUID())).toBeNull()
  })
})
