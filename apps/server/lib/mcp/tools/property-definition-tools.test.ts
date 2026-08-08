import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  listPropertyDefinitions: vi.fn(async () => []),
  getPropertyDefinitionById: vi.fn(async () => null),
  createPropertyDefinition: vi.fn(async () => ({ identifier: "pd1" })),
  updatePropertyDefinition: vi.fn(async () => ({ identifier: "pd1" })),
  deletePropertyDefinition: vi.fn(async () => undefined),
}))

const { registerPropertyDefinitionTools } =
  await import("./property-definition-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const store = await import("@/lib/archimate/store")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerPropertyDefinitionTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("property definition tools", () => {
  it("list_property_definitions lists all definitions", async () => {
    const tools = setup()
    await tools.get("list_property_definitions")!({})
    expect(vi.mocked(store.listPropertyDefinitions)).toHaveBeenCalledWith(1)
  })

  it("get_property_definition calls getPropertyDefinitionById", async () => {
    const tools = setup()
    await tools.get("get_property_definition")!({ id: "pd1" })
    expect(vi.mocked(store.getPropertyDefinitionById)).toHaveBeenCalledWith(
      1,
      "pd1"
    )
  })

  it("create_property_definition creates with a valid type", async () => {
    const tools = setup()
    await tools.get("create_property_definition")!({
      name: "Cost",
      type: "number",
    })
    expect(vi.mocked(store.createPropertyDefinition)).toHaveBeenCalled()
  })

  it("create_property_definition rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("create_property_definition")!({ name: "X", type: "badtype" })
    ).rejects.toThrow(/invalide/i)
  })

  it("create_property_definition defaults to no type when omitted", async () => {
    const tools = setup()
    await tools.get("create_property_definition")!({ name: "Note" })
    expect(vi.mocked(store.createPropertyDefinition)).toHaveBeenCalledWith(1, {
      name: "Note",
      type: undefined,
    })
  })

  it("update_property_definition updates only provided fields", async () => {
    const tools = setup()
    await tools.get("update_property_definition")!({
      id: "pd1",
      name: "NewName",
    })
    expect(vi.mocked(store.updatePropertyDefinition)).toHaveBeenCalledWith(
      1,
      "pd1",
      { name: "NewName" }
    )
  })

  it("update_property_definition rejects an invalid type", async () => {
    const tools = setup()
    await expect(
      tools.get("update_property_definition")!({ id: "pd1", type: "badtype" })
    ).rejects.toThrow(/invalide/i)
  })

  it("update_property_definition passes a valid type through", async () => {
    const tools = setup()
    await tools.get("update_property_definition")!({
      id: "pd1",
      type: "number",
    })
    expect(vi.mocked(store.updatePropertyDefinition)).toHaveBeenCalledWith(
      1,
      "pd1",
      expect.objectContaining({ type: "number" })
    )
  })

  it("delete_property_definition confirms deletion", async () => {
    const tools = setup()
    const result = (await tools.get("delete_property_definition")!({
      id: "pd1",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.deletePropertyDefinition)).toHaveBeenCalledWith(
      1,
      "pd1"
    )
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      identifier: "pd1",
    })
  })
})
