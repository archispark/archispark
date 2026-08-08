import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  getModelInfo: vi.fn(async () => ({ identifier: "m1", name: "Test" })),
  listElementTypes: vi.fn(async () => ["ApplicationComponent"]),
  listElements: vi.fn(async () => []),
  getElementById: vi.fn(async () => null),
  listRelationshipTypes: vi.fn(async () => ["Association"]),
  listRelationships: vi.fn(async () => []),
  getRelationshipById: vi.fn(async () => null),
  listViews: vi.fn(async () => []),
  getViewById: vi.fn(async () => null),
}))

const { registerReadTools } = await import("./read-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const store = await import("@/lib/archimate/store")
const { activeWorkspaceId } = await import("@/lib/archimate/access")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerReadTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("read tools", () => {
  it("get_model_info calls getModelInfo with the active workspace", async () => {
    const tools = setup()
    const result = (await tools.get("get_model_info")!({})) as {
      content: [{ text: string }]
    }
    expect(vi.mocked(store.getModelInfo)).toHaveBeenCalledWith(1)
    expect(result.content[0].text).toContain("m1")
  })

  it("list_element_types groups present types by layer", async () => {
    const tools = setup()
    const result = (await tools.get("list_element_types")!({})) as {
      content: [{ text: string }]
    }
    expect(vi.mocked(activeWorkspaceId)).toHaveBeenCalledWith(TEST_AUTH, "read")
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.layers).toHaveProperty("Business")
  })

  it("list_elements passes filters through", async () => {
    const tools = setup()
    await tools.get("list_elements")!({ element_type: "ApplicationComponent" })
    expect(vi.mocked(store.listElements)).toHaveBeenCalledWith(
      1,
      "ApplicationComponent",
      undefined
    )
  })

  it("list_elements rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("list_elements")!({ element_type: "InvalidType" })
    ).rejects.toThrow(/invalide/i)
  })

  it("get_element calls getElementById", async () => {
    const tools = setup()
    await tools.get("get_element")!({ element_id: "e1" })
    expect(vi.mocked(store.getElementById)).toHaveBeenCalledWith(1, "e1")
  })

  it("list_relationship_types returns types with semantics", async () => {
    const tools = setup()
    const result = (await tools.get("list_relationship_types")!({})) as {
      content: [{ text: string }]
    }
    expect(result.content[0].text).toContain("Association")
  })

  it("list_relationships rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("list_relationships")!({ rel_type: "BadType" })
    ).rejects.toThrow(/invalide/i)
  })

  it("get_relationship calls getRelationshipById", async () => {
    const tools = setup()
    await tools.get("get_relationship")!({ relationship_id: "r1" })
    expect(vi.mocked(store.getRelationshipById)).toHaveBeenCalledWith(1, "r1")
  })

  it("list_views calls listViews", async () => {
    const tools = setup()
    await tools.get("list_views")!({})
    expect(vi.mocked(store.listViews)).toHaveBeenCalledWith(1)
  })

  it("get_view calls getViewById", async () => {
    const tools = setup()
    await tools.get("get_view")!({ view_id: "v1" })
    expect(vi.mocked(store.getViewById)).toHaveBeenCalledWith(1, "v1")
  })
})
