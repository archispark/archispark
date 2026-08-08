import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  createRelationship: vi.fn(async () => ({ identifier: "r1" })),
  updateRelationship: vi.fn(async () => ({ identifier: "r1" })),
  deleteRelationship: vi.fn(async () => undefined),
}))

const { registerRelationshipTools } = await import("./relationship-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const store = await import("@/lib/archimate/store")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerRelationshipTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("relationship tools", () => {
  it("create_relationship creates with a valid type", async () => {
    const tools = setup()
    await tools.get("create_relationship")!({
      type: "Association",
      source: "e1",
      target: "e2",
    })
    expect(vi.mocked(store.createRelationship)).toHaveBeenCalled()
  })

  it("create_relationship rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("create_relationship")!({
        type: "BadType",
        source: "e1",
        target: "e2",
      })
    ).rejects.toThrow(/invalide/i)
  })

  it("update_relationship updates only provided fields", async () => {
    const tools = setup()
    await tools.get("update_relationship")!({
      relationship_id: "r1",
      name: "NewName",
    })
    expect(vi.mocked(store.updateRelationship)).toHaveBeenCalledWith(1, "r1", {
      name: "NewName",
    })
  })

  it("update_relationship rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("update_relationship")!({
        relationship_id: "r1",
        type: "BadType",
      })
    ).rejects.toThrow(/invalide/i)
  })

  it("update_relationship passes multiple optional fields through", async () => {
    const tools = setup()
    await tools.get("update_relationship")!({
      relationship_id: "r1",
      type: "Realization",
      source: "e2",
      target: "e3",
      documentation: "Docs",
      properties: [{ property_definition_ref: "pd1", value: "v1" }],
      access_type: "Read",
      is_directed: true,
      influence_strength: "++",
    })
    expect(vi.mocked(store.updateRelationship)).toHaveBeenCalledWith(
      1,
      "r1",
      expect.objectContaining({
        type: "Realization",
        source: "e2",
        target: "e3",
        documentation: "Docs",
        access_type: "Read",
        is_directed: true,
        influence_strength: "++",
      })
    )
  })

  it("delete_relationship confirms deletion", async () => {
    const tools = setup()
    const result = (await tools.get("delete_relationship")!({
      relationship_id: "r1",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.deleteRelationship)).toHaveBeenCalledWith(1, "r1")
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      identifier: "r1",
    })
  })
})
