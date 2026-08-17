import { describe, it, expect, vi } from "vitest"
import type { PluginRegistryEntry } from "./types"

const FAKE_REGISTRY: Record<string, PluginRegistryEntry> = {
  "test-plugin-a": {
    slug: "test-plugin-a",
    name: "Test Plugin A",
    version: "1.0.0",
    description: "A test plugin",
    type: "icon-pack",
    icons: [
      { slug: "icon-a1", name: "Icon A1", file: "icon-a1.svg" },
      { slug: "icon-a2", name: "Icon A2", file: "icon-a2.svg" },
    ],
  },
  "test-plugin-b": {
    slug: "test-plugin-b",
    name: "Test Plugin B",
    version: "2.0.0",
    description: null,
    type: "icon-pack",
    icons: [{ slug: "icon-b1", name: "Icon B1", file: "icon-b1.svg" }],
  },
}

vi.mock("./registry.generated", () => ({ PLUGIN_REGISTRY: FAKE_REGISTRY }))

const {
  listPlatformPlugins,
  getPlatformPlugin,
  setPluginEnabled,
  getEnabledPluginSlugs,
  listEnabledPluginsWithIcons,
} = await import("./service")
const { NotFoundError } = await import("../archimate/errors")

describe("listPlatformPlugins", () => {
  it("lists every registry plugin, defaulting to disabled with no DB row", async () => {
    const list = await listPlatformPlugins()
    const a = list.find((p) => p.slug === "test-plugin-a")
    expect(a).toMatchObject({
      name: "Test Plugin A",
      version: "1.0.0",
      type: "icon-pack",
      icon_count: 2,
    })
    expect(typeof a?.enabled).toBe("boolean")
  })
})

describe("getPlatformPlugin", () => {
  it("returns the plugin's detail, with admin-preview icon urls", async () => {
    await setPluginEnabled("test-plugin-a", false)
    const detail = await getPlatformPlugin("test-plugin-a")
    expect(detail).toMatchObject({
      slug: "test-plugin-a",
      name: "Test Plugin A",
      type: "icon-pack",
      enabled: false,
    })
    expect(detail.icons).toEqual([
      {
        slug: "icon-a1",
        name: "Icon A1",
        url: "/api/platform/plugins/test-plugin-a/icons/icon-a1",
      },
      {
        slug: "icon-a2",
        name: "Icon A2",
        url: "/api/platform/plugins/test-plugin-a/icons/icon-a2",
      },
    ])
  })

  it("throws NotFoundError for a slug absent from the registry", async () => {
    await expect(getPlatformPlugin("no-such-plugin")).rejects.toBeInstanceOf(
      NotFoundError
    )
  })
})

describe("setPluginEnabled", () => {
  it("enables and disables a known plugin", async () => {
    const enabled = await setPluginEnabled("test-plugin-a", true)
    expect(enabled.enabled).toBe(true)
    const disabled = await setPluginEnabled("test-plugin-a", false)
    expect(disabled.enabled).toBe(false)
  })

  it("throws NotFoundError for a slug absent from the registry", async () => {
    await expect(
      setPluginEnabled("no-such-plugin", true)
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("getEnabledPluginSlugs", () => {
  it("returns only the enabled slugs", async () => {
    await setPluginEnabled("test-plugin-a", true)
    await setPluginEnabled("test-plugin-b", false)
    const enabled = await getEnabledPluginSlugs()
    expect(enabled.has("test-plugin-a")).toBe(true)
    expect(enabled.has("test-plugin-b")).toBe(false)
  })
})

describe("listEnabledPluginsWithIcons", () => {
  it("includes only enabled plugins, with resolved icon urls", async () => {
    await setPluginEnabled("test-plugin-a", true)
    await setPluginEnabled("test-plugin-b", false)
    const list = await listEnabledPluginsWithIcons()
    expect(list.map((p) => p.slug)).toContain("test-plugin-a")
    expect(list.map((p) => p.slug)).not.toContain("test-plugin-b")
    const a = list.find((p) => p.slug === "test-plugin-a")!
    expect(a.icons).toEqual([
      {
        slug: "icon-a1",
        name: "Icon A1",
        url: "/api/plugins/test-plugin-a/icons/icon-a1",
      },
      {
        slug: "icon-a2",
        name: "Icon A2",
        url: "/api/plugins/test-plugin-a/icons/icon-a2",
      },
    ])
  })
})
