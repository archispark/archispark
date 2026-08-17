import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "node:crypto"
import { runMigrations } from "./migrate.js"
import { seedWorkspace } from "./model-io.js"
import { db } from "./connection.js"
import { organizations, imagePacks, imagePackItems } from "./schema.js"
import type { ArchiModel } from "./model.js"
import {
  isImageSlugReference,
  isLegacyImageUrl,
  resolveImageReference,
  assertImageReferenceValid,
} from "./image-library.js"

let ownerOrgId: number
let otherOrgId: number
let ownerWsId: number

function emptyModel(uuid: string): ArchiModel {
  return {
    uuid,
    name: "Empty",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
  }
}

beforeAll(async () => {
  await runMigrations()
  const [ownerOrg] = await db
    .insert(organizations)
    .values({ slug: `image-lib-owner-${randomUUID()}`, name: "Owner Org" })
    .returning({ id: organizations.id })
  const [otherOrg] = await db
    .insert(organizations)
    .values({ slug: `image-lib-other-${randomUUID()}`, name: "Other Org" })
    .returning({ id: organizations.id })
  ownerOrgId = ownerOrg!.id
  otherOrgId = otherOrg!.id
  ownerWsId = await seedWorkspace(
    `image-lib-ws-${randomUUID()}`,
    emptyModel(`image-lib-ws-${randomUUID()}`),
    `image-lib-user-${randomUUID()}`,
    ownerOrgId
  )
})

describe("isImageSlugReference", () => {
  it("matches a kebab-case slug", () => {
    expect(isImageSlugReference("business-actor")).toBe(true)
    expect(isImageSlugReference("aws-lambda")).toBe(true)
  })
  it("rejects anything else", () => {
    expect(isImageSlugReference("https://example.test/a.png")).toBe(false)
    expect(isImageSlugReference("Business-Actor")).toBe(false)
    expect(isImageSlugReference("business_actor")).toBe(false)
    expect(isImageSlugReference("")).toBe(false)
  })
})

describe("isLegacyImageUrl", () => {
  it("accepts http(s) URLs and relative paths", () => {
    expect(isLegacyImageUrl("https://example.test/a.png")).toBe(true)
    expect(isLegacyImageUrl("/icons/a.png")).toBe(true)
  })
  it("rejects everything else", () => {
    expect(isLegacyImageUrl("not a url")).toBe(false)
    expect(isLegacyImageUrl("ftp://example.test/a.png")).toBe(false)
    expect(isLegacyImageUrl("")).toBe(false)
  })
})

describe("resolveImageReference", () => {
  it("resolves a system pack item to the public svg route, from any workspace", async () => {
    const [pack] = await db
      .insert(imagePacks)
      .values({
        uuid: randomUUID(),
        organizationId: null,
        isSystem: true,
        slug: `sys-${randomUUID()}`,
        name: "System Test Pack",
      })
      .returning({ id: imagePacks.id })
    const itemUuid = randomUUID()
    const slug = `icon-${randomUUID()}`
    await db.insert(imagePackItems).values({
      uuid: itemUuid,
      packId: pack!.id,
      organizationId: null,
      slug,
      name: "Icon",
      storageKind: "inline_svg",
      svgContent: "<svg/>",
    })

    const resolved = await resolveImageReference(slug, ownerWsId)
    expect(resolved).toBe(`/api/image-library/items/${itemUuid}/svg`)
  })

  it("resolves a custom pack item owned by the workspace's organization", async () => {
    const [pack] = await db
      .insert(imagePacks)
      .values({
        uuid: randomUUID(),
        organizationId: ownerOrgId,
        isSystem: false,
        slug: `custom-${randomUUID()}`,
        name: "Custom Pack",
      })
      .returning({ id: imagePacks.id })
    const itemUuid = randomUUID()
    const slug = `icon-${randomUUID()}`
    await db.insert(imagePackItems).values({
      uuid: itemUuid,
      packId: pack!.id,
      organizationId: ownerOrgId,
      slug,
      name: "Icon",
      storageKind: "blob",
      blobUrl: "https://blob.example.test/icon.png",
      blobPathname: "image-library/icon.png",
    })

    const resolved = await resolveImageReference(slug, ownerWsId)
    expect(resolved).toBe("https://blob.example.test/icon.png")
  })

  it("does not resolve a custom pack item owned by a different organization", async () => {
    const [pack] = await db
      .insert(imagePacks)
      .values({
        uuid: randomUUID(),
        organizationId: otherOrgId,
        isSystem: false,
        slug: `other-${randomUUID()}`,
        name: "Other Org Pack",
      })
      .returning({ id: imagePacks.id })
    const itemUuid = randomUUID()
    const slug = `icon-${randomUUID()}`
    await db.insert(imagePackItems).values({
      uuid: itemUuid,
      packId: pack!.id,
      organizationId: otherOrgId,
      slug,
      name: "Icon",
      storageKind: "blob",
      blobUrl: "https://blob.example.test/icon.png",
      blobPathname: "image-library/icon.png",
    })

    const resolved = await resolveImageReference(slug, ownerWsId)
    expect(resolved).toBeNull()
  })

  it("prefers the workspace's organization's own item over a system item sharing the same slug", async () => {
    const slug = `shared-${randomUUID()}`

    const [systemPack] = await db
      .insert(imagePacks)
      .values({
        uuid: randomUUID(),
        organizationId: null,
        isSystem: true,
        slug: `sys-${randomUUID()}`,
        name: "System Test Pack",
      })
      .returning({ id: imagePacks.id })
    await db.insert(imagePackItems).values({
      uuid: randomUUID(),
      packId: systemPack!.id,
      organizationId: null,
      slug,
      name: "System Icon",
      storageKind: "blob",
      blobUrl: "https://blob.example.test/system.png",
      blobPathname: "image-library/system.png",
    })

    const [orgPack] = await db
      .insert(imagePacks)
      .values({
        uuid: randomUUID(),
        organizationId: ownerOrgId,
        isSystem: false,
        slug: `custom-${randomUUID()}`,
        name: "Custom Pack",
      })
      .returning({ id: imagePacks.id })
    await db.insert(imagePackItems).values({
      uuid: randomUUID(),
      packId: orgPack!.id,
      organizationId: ownerOrgId,
      slug,
      name: "Org Icon",
      storageKind: "blob",
      blobUrl: "https://blob.example.test/org.png",
      blobPathname: "image-library/org.png",
    })

    const resolved = await resolveImageReference(slug, ownerWsId)
    expect(resolved).toBe("https://blob.example.test/org.png")
  })

  it("passes through a legacy URL unchanged", async () => {
    const resolved = await resolveImageReference(
      "https://example.test/legacy.png",
      ownerWsId
    )
    expect(resolved).toBe("https://example.test/legacy.png")
  })

  it("returns null for an unresolvable reference", async () => {
    expect(
      await resolveImageReference(`no-such-icon-${randomUUID()}`, ownerWsId)
    ).toBeNull()
    expect(
      await resolveImageReference("not an image value", ownerWsId)
    ).toBeNull()
  })
})

describe("assertImageReferenceValid", () => {
  it("resolves without throwing for a valid legacy URL", async () => {
    await expect(
      assertImageReferenceValid("https://example.test/a.png", ownerWsId)
    ).resolves.toBeUndefined()
  })

  it("throws for an unresolvable value", async () => {
    await expect(
      assertImageReferenceValid("not an image value", ownerWsId)
    ).rejects.toThrow(/archispark_image/)
  })
})
