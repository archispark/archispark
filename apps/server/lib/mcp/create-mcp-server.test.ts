import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  getModelInfo: vi.fn(async () => ({ identifier: "m1", name: "Test" })),
  listElementTypes: vi.fn(async () => []),
  listElements: vi.fn(async () => []),
  getElementById: vi.fn(async () => null),
  listRelationshipTypes: vi.fn(async () => []),
  listRelationships: vi.fn(async () => []),
  getRelationshipById: vi.fn(async () => null),
  listViews: vi.fn(async () => []),
  getViewById: vi.fn(async () => null),
  createView: vi.fn(async () => ({ identifier: "v1" })),
  createNode: vi.fn(async () => ({ identifier: "n1" })),
  updateView: vi.fn(async () => ({ identifier: "v1" })),
  deleteView: vi.fn(async () => undefined),
  updateViewNode: vi.fn(async () => ({ identifier: "n1" })),
  deleteViewNode: vi.fn(async () => undefined),
  createViewConnection: vi.fn(async () => ({ identifier: "c1" })),
  updateViewConnection: vi.fn(async () => ({ identifier: "c1" })),
  deleteViewConnection: vi.fn(async () => undefined),
  createElement: vi.fn(async () => ({ identifier: "e1" })),
  updateElement: vi.fn(async () => ({ identifier: "e1" })),
  deleteElement: vi.fn(async () => undefined),
  getElementRelationships: vi.fn(async () => []),
  createRelationship: vi.fn(async () => ({ identifier: "r1" })),
  updateRelationship: vi.fn(async () => ({ identifier: "r1" })),
  deleteRelationship: vi.fn(async () => undefined),
  listPropertyDefinitions: vi.fn(async () => []),
  getPropertyDefinitionById: vi.fn(async () => null),
  createPropertyDefinition: vi.fn(async () => ({ identifier: "pd1" })),
  updatePropertyDefinition: vi.fn(async () => ({ identifier: "pd1" })),
  deletePropertyDefinition: vi.fn(async () => undefined),
  loadModel: vi.fn(async () => ({
    uuid: "m1",
    name: "Test",
    desc: null,
    version: null,
    views: [],
    elements: [],
    relationships: [],
    propertyDefinitions: [],
  })),
  exportModelToXml: vi.fn(async () => "<model/>"),
  importModelFromXml: vi.fn(async () => ({ identifier: "m1" })),
}))

vi.mock("@/lib/archimate/registry", () => ({
  getWorkspaces: vi.fn(async () => [
    { id: "1", name: "Default", active: true },
  ]),
  activateWorkspace: vi.fn(async () => ({
    id: "1",
    name: "Default",
    active: true,
  })),
}))

vi.mock("@/lib/archimate/renderer", () => ({
  renderViewToSvg: vi.fn(() => "<svg/>"),
}))

const registeredTools = new Set<string>()
const registeredPrompts = new Set<string>()
const registeredResources = new Set<string>()

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(function McpServerMock(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts: any
  ) {
    this.opts = opts
    this.registerTool = vi.fn((name: string) => registeredTools.add(name))
    this.registerPrompt = vi.fn((name: string) => registeredPrompts.add(name))
    this.registerResource = vi.fn((name: string) =>
      registeredResources.add(name)
    )
  }),
}))

const { createMcpServer } = await import("./create-mcp-server")
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")

const AUTH = {
  user: { id: "user-admin", username: "admin", role: "user" },
  tokenContext: { organizationId: 1, workspaceId: null },
}

const READ_TOOLS = [
  "get_model_info",
  "list_element_types",
  "list_elements",
  "get_element",
  "list_relationship_types",
  "list_relationships",
  "get_relationship",
  "list_views",
  "get_view",
]
const VIEW_TOOLS = [
  "create_view",
  "create_node",
  "update_view",
  "delete_view",
  "update_node",
  "delete_node",
  "create_connection",
  "update_connection",
  "delete_connection",
  "render_view",
]
const ELEMENT_TOOLS = [
  "create_element",
  "update_element",
  "delete_element",
  "get_element_relationships",
]
const RELATIONSHIP_TOOLS = [
  "create_relationship",
  "update_relationship",
  "delete_relationship",
]
const WORKSPACE_TOOLS = ["list_workspaces", "activate_workspace"]
const MODEL_TOOLS = [
  "export_model",
  "import_model",
  "list_viewpoints",
  "save_model",
]
const PROPERTY_DEFINITION_TOOLS = [
  "list_property_definitions",
  "get_property_definition",
  "create_property_definition",
  "update_property_definition",
  "delete_property_definition",
]

const ALL_TOOLS = [
  ...READ_TOOLS,
  ...VIEW_TOOLS,
  ...ELEMENT_TOOLS,
  ...RELATIONSHIP_TOOLS,
  ...WORKSPACE_TOOLS,
  ...MODEL_TOOLS,
  ...PROPERTY_DEFINITION_TOOLS,
]

describe("createMcpServer", () => {
  it("registers all 37 tools", () => {
    registeredTools.clear()
    createMcpServer(AUTH)
    expect(registeredTools.size).toBe(37)
    for (const name of ALL_TOOLS) {
      expect(registeredTools.has(name)).toBe(true)
    }
  })

  it("registers the 2 prompts and 2 resources", () => {
    registeredPrompts.clear()
    registeredResources.clear()
    createMcpServer(AUTH)
    expect([...registeredPrompts].sort()).toEqual([
      "archimate-modeling-guide",
      "create-viewpoint-view",
    ])
    expect([...registeredResources].sort()).toEqual([
      "archimate-layers",
      "archimate-relationships",
    ])
  })

  it("builds a fresh McpServer with the package version", () => {
    const before = vi.mocked(McpServer).mock.calls.length
    createMcpServer(AUTH)
    expect(vi.mocked(McpServer).mock.calls.length).toBe(before + 1)
    const opts = vi.mocked(McpServer).mock.calls.at(-1)![0] as {
      name: string
      version: string
    }
    expect(opts.name).toBe("ArchiSpark")
    expect(typeof opts.version).toBe("string")
  })
})
