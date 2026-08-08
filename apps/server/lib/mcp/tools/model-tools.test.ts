import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  exportModelToXml: vi.fn(async () => "<model/>"),
  importModelFromXml: vi.fn(async () => ({
    identifier: "m1",
    name: "Imported",
  })),
}))

const { registerModelTools } = await import("./model-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const store = await import("@/lib/archimate/store")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerModelTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("model tools", () => {
  it("export_model returns the XML as text", async () => {
    const tools = setup()
    const result = (await tools.get("export_model")!({})) as {
      content: [{ text: string }]
    }
    expect(vi.mocked(store.exportModelToXml)).toHaveBeenCalledWith(1)
    expect(result.content[0].text).toContain("<model/>")
  })

  it("import_model imports XML and returns model info", async () => {
    const tools = setup()
    const result = (await tools.get("import_model")!({
      xml: "<model/>",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.importModelFromXml)).toHaveBeenCalledWith(
      1,
      "<model/>"
    )
    expect(result.content[0].text).toContain("Imported")
  })

  it("list_viewpoints returns a sorted list", async () => {
    const tools = setup()
    const result = (await tools.get("list_viewpoints")!({})) as {
      content: [{ text: string }]
    }
    const vps = JSON.parse(result.content[0].text) as string[]
    expect(vps).toContain("Layered")
    expect(vps).toEqual([...vps].sort((a, b) => a.localeCompare(b)))
  })

  it("save_model is a no-op returning saved:true", async () => {
    const tools = setup()
    const result = (await tools.get("save_model")!({})) as {
      content: [{ text: string }]
    }
    expect(JSON.parse(result.content[0].text)).toMatchObject({ saved: true })
  })
})
