import { describe, it, expect, vi } from "vitest"
import { randomUUID } from "crypto"
import type { PluginRegistryEntry } from "./types"
import type { ElementOut } from "../archimate/schemas"

const FAKE_REGISTRY: Record<string, PluginRegistryEntry> = {
  "test-plugin": {
    slug: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    description: null,
    type: "icon-pack",
    icons: [{ slug: "test-icon", name: "Test Icon", file: "test-icon.svg" }],
  },
}

vi.mock("./registry.generated", () => ({ PLUGIN_REGISTRY: FAKE_REGISTRY }))

const { db, plugins, ARCHISPARK_IMAGE_PROPERTY_ID } =
  await import("@workspace/db")
const { resolveImageReference, resolveImageReferences, isKnownIconSlug } =
  await import("./resolve")
const { attachResolvedElementImage, attachResolvedElementImages } =
  await import("./element-images")

async function setPluginEnabled(slug: string, enabled: boolean) {
  await db
    .insert(plugins)
    .values({ slug, enabled })
    .onConflictDoUpdate({ target: plugins.slug, set: { enabled } })
}

function elementOutFixture(properties: ElementOut["properties"]): ElementOut {
  return {
    identifier: randomUUID(),
    name: "Fixture",
    type: "Goal",
    documentation: null,
    properties,
  }
}

describe("resolveImageReference", () => {
  it("resolves a known icon slug when its plugin is enabled", async () => {
    await setPluginEnabled("test-plugin", true)
    expect(await resolveImageReference("test-icon")).toBe(
      "/api/plugins/test-plugin/icons/test-icon"
    )
  })

  it("returns null for a known icon slug whose plugin is disabled", async () => {
    await setPluginEnabled("test-plugin", false)
    expect(await resolveImageReference("test-icon")).toBeNull()
  })

  it("returns null for an unknown slug", async () => {
    expect(await resolveImageReference(`unknown-${randomUUID()}`)).toBeNull()
  })

  it("passes through a legacy http(s) URL unchanged", async () => {
    const url = "https://example.test/logo.png"
    expect(await resolveImageReference(url)).toBe(url)
  })
})

describe("isKnownIconSlug", () => {
  it("is true for any registered icon regardless of enabled state", async () => {
    await setPluginEnabled("test-plugin", false)
    expect(isKnownIconSlug("test-icon")).toBe(true)
  })

  it("is false for an unregistered slug", () => {
    expect(isKnownIconSlug(`unknown-${randomUUID()}`)).toBe(false)
  })
})

describe("resolveImageReferences (batch)", () => {
  it("resolves a mixed batch in a single pass", async () => {
    await setPluginEnabled("test-plugin", true)
    const legacyUrl = "https://example.test/logo.png"
    const resolved = await resolveImageReferences([
      "test-icon",
      `unknown-${randomUUID()}`,
      legacyUrl,
    ])
    expect(resolved.get("test-icon")).toBe(
      "/api/plugins/test-plugin/icons/test-icon"
    )
    expect(resolved.get(legacyUrl)).toBe(legacyUrl)
    expect(resolved.size).toBe(2)
  })
})

describe("attachResolvedElementImage", () => {
  it("leaves the element unchanged when archispark_image is absent", async () => {
    const element = elementOutFixture([])
    const result = await attachResolvedElementImage(element)
    expect(result.resolved_image_url).toBeUndefined()
  })

  it("attaches the resolved url when archispark_image is present", async () => {
    await setPluginEnabled("test-plugin", true)
    const element = elementOutFixture([
      {
        property_definition_ref: ARCHISPARK_IMAGE_PROPERTY_ID,
        value: "test-icon",
      },
    ])
    const result = await attachResolvedElementImage(element)
    expect(result.resolved_image_url).toBe(
      "/api/plugins/test-plugin/icons/test-icon"
    )
  })
})

describe("attachResolvedElementImages", () => {
  it("resolves a batch, preserving order", async () => {
    await setPluginEnabled("test-plugin", true)
    const withImage = elementOutFixture([
      {
        property_definition_ref: ARCHISPARK_IMAGE_PROPERTY_ID,
        value: "test-icon",
      },
    ])
    const withoutImage = elementOutFixture([])
    const results = await attachResolvedElementImages([withImage, withoutImage])
    expect(results[0]?.identifier).toBe(withImage.identifier)
    expect(results[0]?.resolved_image_url).toBe(
      "/api/plugins/test-plugin/icons/test-icon"
    )
    expect(results[1]?.resolved_image_url).toBeUndefined()
  })
})
