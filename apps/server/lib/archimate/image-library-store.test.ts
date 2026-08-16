import { describe, it, expect } from "vitest"
import { randomUUID } from "crypto"
import {
  listAllImagePacks,
  createCustomImagePack,
  getManageableCustomPack,
  getSystemInlineSvgItem,
} from "./image-library-store"
import { NotFoundError, ValidationError } from "./errors"

describe("createCustomImagePack / listAllImagePacks", () => {
  it("creates a custom pack, visible instance-wide", async () => {
    const pack = await createCustomImagePack({
      name: "My Pack",
      slug: `my-pack-${randomUUID()}`,
    })
    expect(pack.name).toBe("My Pack")
    expect(pack.is_system).toBe(false)
    expect(pack.items).toEqual([])

    const packs = await listAllImagePacks()
    expect(packs.some((p) => p.identifier === pack.identifier)).toBe(true)
  })

  it("rejects a duplicate slug", async () => {
    const slug = `dup-pack-${randomUUID()}`
    await createCustomImagePack({ name: "First", slug })
    await expect(
      createCustomImagePack({ name: "Second", slug })
    ).rejects.toThrow(ValidationError)
  })

  it("includes the system pack alongside custom packs", async () => {
    const packs = await listAllImagePacks()
    const system = packs.find((p) => p.is_system)
    expect(system).toBeDefined()
    expect(system?.items.length).toBeGreaterThan(0)
  })
})

describe("getManageableCustomPack", () => {
  it("returns the pack row for a custom pack", async () => {
    const pack = await createCustomImagePack({
      name: "Owned",
      slug: `owned-${randomUUID()}`,
    })
    const row = await getManageableCustomPack(pack.identifier)
    expect(row.uuid).toBe(pack.identifier)
  })

  it("throws NotFoundError for a system pack", async () => {
    const packs = await listAllImagePacks()
    const system = packs.find((p) => p.is_system)!
    await expect(
      getManageableCustomPack(system.identifier)
    ).rejects.toThrow(NotFoundError)
  })

  it("throws NotFoundError for an unknown pack uuid", async () => {
    await expect(getManageableCustomPack(randomUUID())).rejects.toThrow(
      NotFoundError
    )
  })
})

describe("getSystemInlineSvgItem", () => {
  it("returns the svg content of a system pack item", async () => {
    const packs = await listAllImagePacks()
    const systemItem = packs.find((p) => p.is_system)?.items[0]
    expect(systemItem).toBeDefined()
    const svg = await getSystemInlineSvgItem(systemItem!.identifier)
    expect(svg).toContain("<svg")
  })

  it("returns null for an unknown item", async () => {
    expect(await getSystemInlineSvgItem(randomUUID())).toBeNull()
  })
})
