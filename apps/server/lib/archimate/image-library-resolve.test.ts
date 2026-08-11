import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import {
  getOrCreatePersonalOrganization,
  seedWorkspace,
  db,
  imagePacks,
  imagePackItems,
  ARCHISPARK_IMAGE_PROPERTY_ID,
} from "@workspace/db"
import type { ArchiModel } from "@workspace/db"
import type { ElementOut } from "./schemas"
import {
  resolveElementImages,
  attachResolvedElementImage,
  attachResolvedElementImages,
} from "./image-library-resolve"

let wsId: number
let validRef: string

beforeAll(async () => {
  const organizationId = await getOrCreatePersonalOrganization(
    `image-lib-resolve-owner-${randomUUID()}`
  )
  wsId = await seedWorkspace(
    `image-lib-resolve-ws-${randomUUID()}`,
    {
      uuid: `id-${randomUUID()}`,
      name: "Image Resolve Test",
      desc: null,
      version: null,
      elements: [],
      relationships: [],
      propertyDefinitions: [],
      views: [],
    },
    `image-lib-resolve-user-${randomUUID()}`,
    organizationId
  )

  const [pack] = await db
    .insert(imagePacks)
    .values({
      uuid: randomUUID(),
      organizationId,
      isSystem: false,
      slug: `resolve-test-pack-${randomUUID()}`,
      name: "Resolve Test Pack",
    })
    .returning({ id: imagePacks.id })
  const itemUuid = randomUUID()
  await db.insert(imagePackItems).values({
    uuid: itemUuid,
    packId: pack!.id,
    slug: "icon",
    name: "Icon",
    storageKind: "blob",
    blobUrl: "https://blob.example.test/icon.png",
  })
  validRef = `img-${itemUuid}`
})

function emptyModel(): ArchiModel {
  return {
    uuid: `id-${randomUUID()}`,
    name: "Model",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
  }
}

describe("resolveElementImages", () => {
  it("resolves only entities with a resolvable archispark_image value", async () => {
    const model = emptyModel()
    model.elements = [
      {
        uuid: "el-with-image",
        name: "A",
        type: "Goal",
        desc: null,
        props: { [ARCHISPARK_IMAGE_PROPERTY_ID]: validRef },
      },
      {
        uuid: "el-without-image",
        name: "B",
        type: "Goal",
        desc: null,
        props: {},
      },
    ]
    model.relationships = [
      {
        uuid: "rel-unresolvable",
        name: null,
        type: "Association",
        source: "el-with-image",
        target: "el-without-image",
        desc: null,
        props: { [ARCHISPARK_IMAGE_PROPERTY_ID]: `img-${randomUUID()}` },
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
    ]

    const images = await resolveElementImages(model, wsId)
    expect(images.get("el-with-image")).toBe(
      "https://blob.example.test/icon.png"
    )
    expect(images.has("el-without-image")).toBe(false)
    expect(images.has("rel-unresolvable")).toBe(false)
  })
})

function elementOutFixture(properties: ElementOut["properties"]): ElementOut {
  return {
    identifier: randomUUID(),
    name: "Fixture",
    type: "Goal",
    documentation: null,
    properties,
  }
}

describe("attachResolvedElementImage", () => {
  it("leaves the element unchanged when archispark_image is absent", async () => {
    const element = elementOutFixture([])
    const result = await attachResolvedElementImage(element, wsId)
    expect(result.resolved_image_url).toBeUndefined()
  })

  it("attaches the resolved url when archispark_image is present", async () => {
    const element = elementOutFixture([
      { property_definition_ref: ARCHISPARK_IMAGE_PROPERTY_ID, value: validRef },
    ])
    const result = await attachResolvedElementImage(element, wsId)
    expect(result.resolved_image_url).toBe(
      "https://blob.example.test/icon.png"
    )
  })
})

describe("attachResolvedElementImages", () => {
  it("resolves a batch, preserving order", async () => {
    const withImage = elementOutFixture([
      { property_definition_ref: ARCHISPARK_IMAGE_PROPERTY_ID, value: validRef },
    ])
    const withoutImage = elementOutFixture([])
    const results = await attachResolvedElementImages(
      [withImage, withoutImage],
      wsId
    )
    expect(results[0]?.identifier).toBe(withImage.identifier)
    expect(results[0]?.resolved_image_url).toBe(
      "https://blob.example.test/icon.png"
    )
    expect(results[1]?.resolved_image_url).toBeUndefined()
  })
})
