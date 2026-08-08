import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/access", () => ({
  activeWorkspaceId: vi.fn(async () => 1),
}))

vi.mock("@/lib/archimate/store", () => ({
  createView: vi.fn(async () => ({ identifier: "v1" })),
  createNode: vi.fn(async () => ({ identifier: "n1" })),
  updateView: vi.fn(async () => ({ identifier: "v1", name: "Updated" })),
  deleteView: vi.fn(async () => undefined),
  updateViewNode: vi.fn(async () => ({ identifier: "n1" })),
  deleteViewNode: vi.fn(async () => undefined),
  createViewConnection: vi.fn(async () => ({ identifier: "c1" })),
  updateViewConnection: vi.fn(async () => ({ identifier: "c1" })),
  deleteViewConnection: vi.fn(async () => undefined),
  loadModel: vi.fn(async () => ({
    uuid: "m1",
    name: "Test",
    desc: null,
    version: null,
    views: [{ uuid: "v1" }],
    elements: [],
    relationships: [],
    propertyDefinitions: [],
  })),
}))

vi.mock("@/lib/archimate/renderer", () => ({
  renderViewToSvg: vi.fn(() => "<svg/>"),
}))

const { registerViewTools } = await import("./view-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const store = await import("@/lib/archimate/store")
const { renderViewToSvg } = await import("@/lib/archimate/renderer")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerViewTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("view tools", () => {
  it("create_view forwards name/viewpoint/documentation", async () => {
    const tools = setup()
    await tools.get("create_view")!({ name: "My View" })
    expect(vi.mocked(store.createView)).toHaveBeenCalledWith(1, {
      name: "My View",
      viewpoint: undefined,
      documentation: undefined,
    })
  })

  it("create_node forwards element placement", async () => {
    const tools = setup()
    await tools.get("create_node")!({ view_id: "v1", element_id: "e1" })
    expect(vi.mocked(store.createNode)).toHaveBeenCalledWith(1, "v1", {
      element_id: "e1",
      x: undefined,
      y: undefined,
      w: undefined,
      h: undefined,
    })
  })

  it("update_view only passes provided fields", async () => {
    const tools = setup()
    await tools.get("update_view")!({ view_id: "v1", documentation: null })
    expect(vi.mocked(store.updateView)).toHaveBeenCalledWith(1, "v1", {
      documentation: null,
    })
  })

  it("update_view passes viewpoint when provided", async () => {
    const tools = setup()
    await tools.get("update_view")!({ view_id: "v1", viewpoint: "Layered" })
    expect(vi.mocked(store.updateView)).toHaveBeenCalledWith(
      1,
      "v1",
      expect.objectContaining({ viewpoint: "Layered" })
    )
  })

  it("delete_view confirms deletion", async () => {
    const tools = setup()
    const result = (await tools.get("delete_view")!({ view_id: "v1" })) as {
      content: [{ text: string }]
    }
    expect(vi.mocked(store.deleteView)).toHaveBeenCalledWith(1, "v1")
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      identifier: "v1",
    })
  })

  it("update_node passes provided dimensions and name", async () => {
    const tools = setup()
    await tools.get("update_node")!({
      view_id: "v1",
      node_id: "n1",
      w: 200,
      h: 80,
      name: "Renamed",
    })
    expect(vi.mocked(store.updateViewNode)).toHaveBeenCalledWith(
      1,
      "v1",
      "n1",
      expect.objectContaining({ w: 200, h: 80, name: "Renamed" })
    )
  })

  it("delete_node confirms deletion", async () => {
    const tools = setup()
    const result = (await tools.get("delete_node")!({
      view_id: "v1",
      node_id: "n1",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.deleteViewNode)).toHaveBeenCalledWith(1, "v1", "n1")
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      identifier: "n1",
    })
  })

  it("create_connection forwards source/target", async () => {
    const tools = setup()
    await tools.get("create_connection")!({
      view_id: "v1",
      source: "n1",
      target: "n2",
    })
    expect(vi.mocked(store.createViewConnection)).toHaveBeenCalledWith(
      1,
      "v1",
      expect.objectContaining({ source: "n1", target: "n2" })
    )
  })

  it("update_connection passes provided optional fields", async () => {
    const tools = setup()
    await tools.get("update_connection")!({
      view_id: "v1",
      connection_id: "c1",
      source: "n2",
      target: "n3",
      source_side: "right",
      target_side: "left",
    })
    expect(vi.mocked(store.updateViewConnection)).toHaveBeenCalledWith(
      1,
      "v1",
      "c1",
      expect.objectContaining({
        source: "n2",
        target: "n3",
        source_side: "right",
        target_side: "left",
      })
    )
  })

  it("delete_connection confirms deletion", async () => {
    const tools = setup()
    const result = (await tools.get("delete_connection")!({
      view_id: "v1",
      connection_id: "c1",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(store.deleteViewConnection)).toHaveBeenCalledWith(
      1,
      "v1",
      "c1"
    )
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      identifier: "c1",
    })
  })

  it("render_view returns an SVG image when the view exists", async () => {
    const tools = setup()
    const result = (await tools.get("render_view")!({ view_id: "v1" })) as {
      content: [{ mimeType: string }]
    }
    expect(vi.mocked(renderViewToSvg)).toHaveBeenCalled()
    expect(result.content[0].mimeType).toBe("image/svg+xml")
  })

  it("render_view throws when the view is not found", async () => {
    const tools = setup()
    await expect(
      tools.get("render_view")!({ view_id: "missing" })
    ).rejects.toThrow(/introuvable/i)
  })
})
