import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  createElement: vi.fn(async () => ({ identifier: "e1" })),
  updateElement: vi.fn(async () => ({ identifier: "e1" })),
  deleteElement: vi.fn(async () => undefined),
  getElementRelationships: vi.fn(async () => []),
  listElementsInViews: vi.fn(async () => ["e1", "e2"]),
}))

const { registerElementTools } = await import("./element-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const store = await import("@/lib/archimate/store")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerElementTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("element tools", () => {
  it("create_element creates with a valid type", async () => {
    const tools = setup()
    await tools.get("create_element")!({
      name: "MyApp",
      type: "ApplicationComponent",
    })
    expect(vi.mocked(store.createElement)).toHaveBeenCalled()
  })

  it("create_element rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("create_element")!({ name: "X", type: "BadType" })
    ).rejects.toThrow(/invalide/i)
  })

  it("update_element updates only provided fields", async () => {
    const tools = setup()
    await tools.get("update_element")!({ element_id: "e1", name: "NewName" })
    expect(vi.mocked(store.updateElement)).toHaveBeenCalledWith(1, "e1", {
      name: "NewName",
    })
  })

  it("update_element rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("update_element")!({ element_id: "e1", type: "BadType" })
    ).rejects.toThrow(/invalide/i)
  })

  it("update_element passes documentation and properties when provided", async () => {
    const tools = setup()
    await tools.get("update_element")!({
      element_id: "e1",
      documentation: "Some docs",
      properties: [{ property_definition_ref: "pd1", value: "v1" }],
    })
    expect(vi.mocked(store.updateElement)).toHaveBeenCalledWith(
      1,
      "e1",
      expect.objectContaining({
        documentation: "Some docs",
        properties: expect.any(Array),
      })
    )
  })

  it("delete_element confirms deletion", async () => {
    const tools = setup()
    const result = (await tools.get("delete_element")!({
      element_id: "e1",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.deleteElement)).toHaveBeenCalledWith(1, "e1")
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      identifier: "e1",
    })
  })

  it("get_element_relationships returns relationships", async () => {
    const tools = setup()
    const result = (await tools.get("get_element_relationships")!({
      element_id: "e1",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.getElementRelationships)).toHaveBeenCalledWith(
      1,
      "e1"
    )
    expect(result.content[0].text).toBe("[]")
  })

  it("list_elements_in_views returns element ids", async () => {
    const tools = setup()
    const result = (await tools.get("list_elements_in_views")!({})) as {
      content: [{ text: string }]
    }
    expect(vi.mocked(store.listElementsInViews)).toHaveBeenCalledWith(1)
    expect(result.content[0].text).toContain("e1")
  })
})
