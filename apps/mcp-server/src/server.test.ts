import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Hoisted shared state — accessible inside vi.mock() factories
// ---------------------------------------------------------------------------

const shared = vi.hoisted(() => {
  let onInit: ((id: string) => void) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReq = vi.fn((_req: unknown, res: any) => {
    if (res?.status) res.status(200).json({ jsonrpc: "2.0", id: 1, result: {} });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolHandlers = new Map<string, (args: any) => Promise<unknown>>();
  return {
    handleReq,
    toolHandlers,
    setOnInit: (fn: (id: string) => void) => { onInit = fn; },
    callOnInit: (id: string) => { if (onInit) onInit(id); },
  };
});

// ---------------------------------------------------------------------------
// Mock api package
// ---------------------------------------------------------------------------

vi.mock("api/package.json", () => ({ default: { version: "0.0.0-test" } }));

vi.mock("api/src/registry.js", () => ({
  getActiveWorkspaceId: vi.fn().mockResolvedValue(1),
  getWorkspaces: vi.fn().mockResolvedValue([{ id: "1", name: "Default", active: true }]),
  activateWorkspace: vi.fn().mockResolvedValue({ id: "2", name: "Other", active: true }),
}));

vi.mock("api/src/store.js", () => ({
  getModelInfo: vi.fn().mockResolvedValue({ identifier: "m1", name: "Test" }),
  listElementTypes: vi.fn().mockResolvedValue(["ApplicationComponent"]),
  listElements: vi.fn().mockResolvedValue([]),
  getElementById: vi.fn().mockResolvedValue(null),
  listRelationshipTypes: vi.fn().mockResolvedValue(["Association"]),
  listRelationships: vi.fn().mockResolvedValue([]),
  getRelationshipById: vi.fn().mockResolvedValue(null),
  listViews: vi.fn().mockResolvedValue([]),
  getViewById: vi.fn().mockResolvedValue(null),
  createView: vi.fn().mockResolvedValue({ identifier: "v1" }),
  updateView: vi.fn().mockResolvedValue({ identifier: "v1", name: "Updated" }),
  deleteView: vi.fn().mockResolvedValue(undefined),
  createNode: vi.fn().mockResolvedValue({ identifier: "n1" }),
  updateViewNode: vi.fn().mockResolvedValue({ identifier: "n1" }),
  deleteViewNode: vi.fn().mockResolvedValue(undefined),
  createViewConnection: vi.fn().mockResolvedValue({ identifier: "c1" }),
  updateViewConnection: vi.fn().mockResolvedValue({ identifier: "c1" }),
  deleteViewConnection: vi.fn().mockResolvedValue(undefined),
  createElement: vi.fn().mockResolvedValue({ identifier: "e1" }),
  updateElement: vi.fn().mockResolvedValue({ identifier: "e1" }),
  deleteElement: vi.fn().mockResolvedValue(undefined),
  getElementRelationships: vi.fn().mockResolvedValue([]),
  listElementsInViews: vi.fn().mockResolvedValue(["e1", "e2"]),
  createRelationship: vi.fn().mockResolvedValue({ identifier: "r1" }),
  updateRelationship: vi.fn().mockResolvedValue({ identifier: "r1" }),
  deleteRelationship: vi.fn().mockResolvedValue(undefined),
  listPropertyDefinitions: vi.fn().mockResolvedValue([]),
  getPropertyDefinitionById: vi.fn().mockResolvedValue(null),
  createPropertyDefinition: vi.fn().mockResolvedValue({ identifier: "pd1" }),
  updatePropertyDefinition: vi.fn().mockResolvedValue({ identifier: "pd1" }),
  deletePropertyDefinition: vi.fn().mockResolvedValue(undefined),
  loadModel: vi.fn().mockResolvedValue({ uuid: "m1", name: "Test", desc: null, version: null, views: [], elements: [], relationships: [], propertyDefinitions: [] }),
  exportModelToXml: vi.fn().mockResolvedValue("<model/>"),
  importModelFromXml: vi.fn().mockResolvedValue({ identifier: "m1", name: "Imported" }),
}));

vi.mock("api/src/renderer.js", () => ({
  renderViewToSvg: vi.fn().mockReturnValue("<svg/>"),
}));

vi.mock("api/src/schemas.js", () => ({
  ELEMENT_TYPES: new Set(["ApplicationComponent", "BusinessActor"]),
  RELATIONSHIP_TYPES: new Set(["Association", "Realization"]),
  PROPERTY_DEFINITION_TYPES: new Set(["string", "number"]),
  VIEWPOINTS: new Set(["Layered", "Application Structure", "Technology"]),
}));

// Set the MCP token env var before the app module is loaded so the auth middleware uses it
const TEST_TOKEN = vi.hoisted(() => {
  process.env["MCP_AUTH_TOKEN"] = "test-mcp-bearer-token-fixture";
  return "test-mcp-bearer-token-fixture";
});

// ---------------------------------------------------------------------------
// Mock MCP SDK — capture registered tool handlers for direct testing
// ---------------------------------------------------------------------------

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  McpServer: vi.fn().mockImplementation(function McpServerMock(this: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.registerTool = vi.fn().mockImplementation((_name: string, _schema: unknown, handler: (args: any) => Promise<unknown>) => {
      shared.toolHandlers.set(_name, handler);
    });
    this.registerPrompt = vi.fn();
    this.registerResource = vi.fn();
    this.connect = vi.fn().mockImplementation(async () => shared.callOnInit("test-session-abc"));
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StreamableHTTPServerTransport: vi.fn().mockImplementation(function TransportMock(this: any, opts: any) {
    shared.setOnInit(opts.onsessioninitialized);
    this.handleRequest = shared.handleReq;
    this.close = vi.fn();
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { app } from "./server.js";
import {
  getModelInfo, listElementTypes, listElements, getElementById,
  listRelationshipTypes, listRelationships, getRelationshipById,
  listViews, getViewById,
  createView, updateView, deleteView,
  createNode, updateViewNode, deleteViewNode,
  createViewConnection, updateViewConnection, deleteViewConnection,
  createElement, updateElement, deleteElement,
  getElementRelationships, listElementsInViews,
  createRelationship, updateRelationship, deleteRelationship,
  listPropertyDefinitions, getPropertyDefinitionById,
  createPropertyDefinition, updatePropertyDefinition, deletePropertyDefinition,
  loadModel, exportModelToXml, importModelFromXml,
} from "api/src/store.js";
import { getWorkspaces, activateWorkspace } from "api/src/registry.js";
import { renderViewToSvg } from "api/src/renderer.js";

// ---------------------------------------------------------------------------
// Helper: a POST request triggers createMcpServer() → registers tools
// ---------------------------------------------------------------------------

async function initSession(): Promise<void> {
  await request(app).post("/mcp/").set("Authorization", `Bearer ${TEST_TOKEN}`).send({ method: "initialize", params: {} });
}

// Tools are registered lazily, per request (createMcpServer). Trigger one POST
// up front so the tool-handler tests find their handlers regardless of order.
beforeAll(async () => { await initSession(); });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
  const handler = shared.toolHandlers.get(name);
  if (!handler) throw new Error(`Tool not registered: ${name}`);
  return handler(args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CORS middleware", () => {
  it("responds 204 to OPTIONS", async () => {
    const res = await request(app).options("/mcp/");
    expect(res.status).toBe(204);
  });

  it("sets Access-Control-Allow-Origin: *", async () => {
    const res = await request(app).options("/mcp/");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("includes POST and DELETE in Allow-Methods", async () => {
    const res = await request(app).options("/mcp/");
    const methods = res.headers["access-control-allow-methods"] as string;
    expect(methods).toContain("POST");
    expect(methods).toContain("DELETE");
  });

  it("includes mcp-session-id in Allow-Headers", async () => {
    const res = await request(app).options("/mcp/");
    expect(res.headers["access-control-allow-headers"]).toContain("mcp-session-id");
  });
});

describe("POST /mcp/ (stateless)", () => {
  it("handles an initialize request via a fresh transport and returns 200", async () => {
    shared.handleReq.mockClear();
    const res = await request(app).post("/mcp/").set("Authorization", `Bearer ${TEST_TOKEN}`).send({ method: "initialize", params: {} });
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });

  it("handles a request with no session header (no 400 — stateless)", async () => {
    shared.handleReq.mockClear();
    const res = await request(app).post("/mcp/").set("Authorization", `Bearer ${TEST_TOKEN}`).send({ method: "tools/call", params: {} });
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const res = await request(app).post("/mcp/").set("Authorization", "Bearer wrong-token").send({ method: "initialize", params: {} });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/authentifi/i);
  });

  it("returns 401 when Authorization header is absent", async () => {
    const res = await request(app).post("/mcp/").send({ method: "initialize", params: {} });
    expect(res.status).toBe(401);
  });

  it("returns 500 when transport throws", async () => {
    shared.handleReq.mockRejectedValueOnce(new Error("transport crash"));
    const res = await request(app).post("/mcp/").set("Authorization", `Bearer ${TEST_TOKEN}`).send({ method: "initialize", params: {} });
    expect(res.status).toBe(500);
  });

  it("builds a fresh McpServer per request (no shared instance → no 'Already connected')", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const before = vi.mocked(McpServer).mock.calls.length;
    await request(app).post("/mcp/").set("Authorization", `Bearer ${TEST_TOKEN}`).send({ method: "initialize", params: {} });
    await request(app).post("/mcp/").set("Authorization", `Bearer ${TEST_TOKEN}`).send({ method: "initialize", params: {} });
    // One McpServer constructed per request. A shared module-level instance
    // (the old bug) would construct zero here and throw "Already connected".
    expect(vi.mocked(McpServer).mock.calls.length).toBe(before + 2);
  });
});

describe("GET /mcp/ (stateless → 405)", () => {
  it("returns 405 Method Not Allowed", async () => {
    const res = await request(app).get("/mcp/");
    expect(res.status).toBe(405);
    expect(res.body.error.message).toMatch(/stateless/i);
  });
});

describe("DELETE /mcp/ (stateless → 405)", () => {
  it("returns 405 Method Not Allowed", async () => {
    const res = await request(app).delete("/mcp/");
    expect(res.status).toBe(405);
    expect(res.body.error.message).toMatch(/stateless/i);
  });
});

// ---------------------------------------------------------------------------
// MCP tool handlers — called directly via captured handlers
// ---------------------------------------------------------------------------

describe("MCP tool: get_model_info", () => {
  it("returns model info wrapped in content", async () => {
    const result = await callTool("get_model_info");
    expect(vi.mocked(getModelInfo)).toHaveBeenCalledWith(1);
    expect(result.content[0].text).toContain("m1");
  });
});

describe("MCP tool: list_element_types", () => {
  it("returns element types", async () => {
    const result = await callTool("list_element_types");
    expect(vi.mocked(listElementTypes)).toHaveBeenCalledWith(1);
    expect(result.content[0].text).toContain("ApplicationComponent");
  });
});

describe("MCP tool: list_elements", () => {
  it("lists elements without filter", async () => {
    const result = await callTool("list_elements", {});
    expect(vi.mocked(listElements)).toHaveBeenCalled();
    expect(result.content[0].text).toBe("[]");
  });

  it("lists elements with valid type filter", async () => {
    await callTool("list_elements", { element_type: "ApplicationComponent" });
    expect(vi.mocked(listElements)).toHaveBeenCalledWith(1, "ApplicationComponent", undefined);
  });

  it("throws on invalid element_type", async () => {
    await expect(callTool("list_elements", { element_type: "InvalidType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: get_element", () => {
  it("calls getElementById", async () => {
    await callTool("get_element", { element_id: "e1" });
    expect(vi.mocked(getElementById)).toHaveBeenCalledWith(1, "e1");
  });
});

describe("MCP tool: list_relationship_types", () => {
  it("returns relationship types", async () => {
    const result = await callTool("list_relationship_types");
    expect(vi.mocked(listRelationshipTypes)).toHaveBeenCalledWith(1);
    expect(result.content[0].text).toContain("Association");
  });
});

describe("MCP tool: list_relationships", () => {
  it("lists relationships without filter", async () => {
    await callTool("list_relationships", {});
    expect(vi.mocked(listRelationships)).toHaveBeenCalled();
  });

  it("throws on invalid rel_type", async () => {
    await expect(callTool("list_relationships", { rel_type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: get_relationship", () => {
  it("calls getRelationshipById", async () => {
    await callTool("get_relationship", { relationship_id: "r1" });
    expect(vi.mocked(getRelationshipById)).toHaveBeenCalledWith(1, "r1");
  });
});

describe("MCP tool: list_views", () => {
  it("returns views", async () => {
    await callTool("list_views");
    expect(vi.mocked(listViews)).toHaveBeenCalledWith(1);
  });
});

describe("MCP tool: get_view", () => {
  it("calls getViewById", async () => {
    await callTool("get_view", { view_id: "v1" });
    expect(vi.mocked(getViewById)).toHaveBeenCalledWith(1, "v1");
  });
});

describe("MCP tool: create_view", () => {
  it("calls createView", async () => {
    await callTool("create_view", { name: "My View" });
    expect(vi.mocked(createView)).toHaveBeenCalledWith(1, { name: "My View", viewpoint: undefined, documentation: undefined });
  });
});

describe("MCP tool: create_node", () => {
  it("calls createNode", async () => {
    await callTool("create_node", { view_id: "v1", element_id: "e1" });
    expect(vi.mocked(createNode)).toHaveBeenCalledWith(1, "v1", { element_id: "e1", x: undefined, y: undefined, w: undefined, h: undefined });
  });
});

describe("MCP tool: create_element", () => {
  it("creates element with valid type", async () => {
    await callTool("create_element", { name: "MyApp", type: "ApplicationComponent" });
    expect(vi.mocked(createElement)).toHaveBeenCalled();
  });

  it("throws on invalid type", async () => {
    await expect(callTool("create_element", { name: "X", type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: update_element", () => {
  it("updates element name", async () => {
    await callTool("update_element", { element_id: "e1", name: "NewName" });
    expect(vi.mocked(updateElement)).toHaveBeenCalledWith(1, "e1", { name: "NewName" });
  });

  it("throws on invalid type", async () => {
    await expect(callTool("update_element", { element_id: "e1", type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: delete_element", () => {
  it("deletes element and returns confirmation", async () => {
    const result = await callTool("delete_element", { element_id: "e1" });
    expect(vi.mocked(deleteElement)).toHaveBeenCalledWith(1, "e1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "e1" });
  });
});

describe("MCP tool: create_relationship", () => {
  it("creates relationship with valid type", async () => {
    await callTool("create_relationship", { type: "Association", source: "e1", target: "e2" });
    expect(vi.mocked(createRelationship)).toHaveBeenCalled();
  });

  it("throws on invalid type", async () => {
    await expect(callTool("create_relationship", { type: "BadType", source: "e1", target: "e2" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: update_relationship", () => {
  it("updates relationship name", async () => {
    await callTool("update_relationship", { relationship_id: "r1", name: "NewName" });
    expect(vi.mocked(updateRelationship)).toHaveBeenCalledWith(1, "r1", { name: "NewName" });
  });

  it("throws on invalid type", async () => {
    await expect(callTool("update_relationship", { relationship_id: "r1", type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: delete_relationship", () => {
  it("deletes relationship and returns confirmation", async () => {
    const result = await callTool("delete_relationship", { relationship_id: "r1" });
    expect(vi.mocked(deleteRelationship)).toHaveBeenCalledWith(1, "r1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "r1" });
  });
});

describe("MCP tool: list_property_definitions", () => {
  it("returns property definitions", async () => {
    await callTool("list_property_definitions");
    expect(vi.mocked(listPropertyDefinitions)).toHaveBeenCalledWith(1);
  });
});

describe("MCP tool: get_property_definition", () => {
  it("calls getPropertyDefinitionById", async () => {
    await callTool("get_property_definition", { id: "pd1" });
    expect(vi.mocked(getPropertyDefinitionById)).toHaveBeenCalledWith(1, "pd1");
  });
});

describe("MCP tool: create_property_definition", () => {
  it("creates with valid type", async () => {
    await callTool("create_property_definition", { name: "Cost", type: "number" });
    expect(vi.mocked(createPropertyDefinition)).toHaveBeenCalled();
  });

  it("throws on invalid type", async () => {
    await expect(callTool("create_property_definition", { name: "X", type: "badtype" }))
      .rejects.toThrow(/invalide/i);
  });

  it("creates without type (defaults to string)", async () => {
    await callTool("create_property_definition", { name: "Note" });
    expect(vi.mocked(createPropertyDefinition)).toHaveBeenCalledWith(1, { name: "Note", type: undefined });
  });
});

describe("MCP tool: update_property_definition", () => {
  it("updates property definition name", async () => {
    await callTool("update_property_definition", { id: "pd1", name: "NewName" });
    expect(vi.mocked(updatePropertyDefinition)).toHaveBeenCalledWith(1, "pd1", { name: "NewName" });
  });

  it("throws on invalid type", async () => {
    await expect(callTool("update_property_definition", { id: "pd1", type: "badtype" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: delete_property_definition", () => {
  it("deletes and returns confirmation", async () => {
    const result = await callTool("delete_property_definition", { id: "pd1" });
    expect(vi.mocked(deletePropertyDefinition)).toHaveBeenCalledWith(1, "pd1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "pd1" });
  });
});

describe("MCP tool: save_model", () => {
  it("returns saved:true (no-op — persistence is immediate)", async () => {
    const result = await callTool("save_model");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ saved: true });
  });
});

const modelWithViews = (views: { uuid: string }[]) => ({
  uuid: "m1", name: "Test", desc: null, version: null,
  views, elements: [], relationships: [], propertyDefinitions: [],
});

describe("MCP tool: render_view", () => {
  it("returns SVG by default when view exists", async () => {
    vi.mocked(loadModel).mockResolvedValueOnce(modelWithViews([{ uuid: "v1" }]) as never);
    const result = await callTool("render_view", { view_id: "v1" });
    expect(vi.mocked(renderViewToSvg)).toHaveBeenCalled();
    expect(result.content[0].mimeType).toBe("image/svg+xml");
  });

  it("throws when view not found", async () => {
    vi.mocked(loadModel).mockResolvedValueOnce(modelWithViews([]) as never);
    await expect(callTool("render_view", { view_id: "missing" }))
      .rejects.toThrow(/introuvable/i);
  });
});

// ---------------------------------------------------------------------------
// New tools – View mutations
// ---------------------------------------------------------------------------

describe("MCP tool: update_view", () => {
  it("updates view name", async () => {
    const result = await callTool("update_view", { view_id: "v1", name: "New Name" });
    expect(vi.mocked(updateView)).toHaveBeenCalledWith(1, "v1", { name: "New Name" });
    expect(result.content[0].text).toContain("Updated");
  });

  it("passes only provided fields", async () => {
    await callTool("update_view", { view_id: "v1", documentation: null });
    expect(vi.mocked(updateView)).toHaveBeenCalledWith(1, "v1", { documentation: null });
  });
});

describe("MCP tool: delete_view", () => {
  it("deletes view and returns confirmation", async () => {
    const result = await callTool("delete_view", { view_id: "v1" });
    expect(vi.mocked(deleteView)).toHaveBeenCalledWith(1, "v1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "v1" });
  });
});

describe("MCP tool: update_node", () => {
  it("updates node position", async () => {
    await callTool("update_node", { view_id: "v1", node_id: "n1", x: 10, y: 20 });
    expect(vi.mocked(updateViewNode)).toHaveBeenCalledWith(1, "v1", "n1", { x: 10, y: 20 });
  });
});

describe("MCP tool: delete_node", () => {
  it("deletes node and returns confirmation", async () => {
    const result = await callTool("delete_node", { view_id: "v1", node_id: "n1" });
    expect(vi.mocked(deleteViewNode)).toHaveBeenCalledWith(1, "v1", "n1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "n1" });
  });
});

describe("MCP tool: create_connection", () => {
  it("creates connection between two nodes", async () => {
    const result = await callTool("create_connection", { view_id: "v1", source: "n1", target: "n2" });
    expect(vi.mocked(createViewConnection)).toHaveBeenCalledWith(1, "v1", expect.objectContaining({ source: "n1", target: "n2" }));
    expect(result.content[0].text).toContain("c1");
  });
});

describe("MCP tool: update_connection", () => {
  it("updates connection name", async () => {
    await callTool("update_connection", { view_id: "v1", connection_id: "c1", name: "flow" });
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith(1, "v1", "c1", { name: "flow" });
  });
});

describe("MCP tool: delete_connection", () => {
  it("deletes connection and returns confirmation", async () => {
    const result = await callTool("delete_connection", { view_id: "v1", connection_id: "c1" });
    expect(vi.mocked(deleteViewConnection)).toHaveBeenCalledWith(1, "v1", "c1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "c1" });
  });
});

// ---------------------------------------------------------------------------
// New tools – Element utilities
// ---------------------------------------------------------------------------

describe("MCP tool: get_element_relationships", () => {
  it("returns relationships for an element", async () => {
    const result = await callTool("get_element_relationships", { element_id: "e1" });
    expect(vi.mocked(getElementRelationships)).toHaveBeenCalledWith(1, "e1");
    expect(result.content[0].text).toBe("[]");
  });
});

describe("MCP tool: list_elements_in_views", () => {
  it("returns element ids present in views", async () => {
    const result = await callTool("list_elements_in_views");
    expect(vi.mocked(listElementsInViews)).toHaveBeenCalledWith(1);
    expect(result.content[0].text).toContain("e1");
  });
});

// ---------------------------------------------------------------------------
// New tools – Workspaces
// ---------------------------------------------------------------------------

describe("MCP tool: list_workspaces", () => {
  it("lists available workspaces", async () => {
    const result = await callTool("list_workspaces");
    expect(vi.mocked(getWorkspaces)).toHaveBeenCalled();
    expect(result.content[0].text).toContain("Default");
  });
});

describe("MCP tool: activate_workspace", () => {
  it("activates a workspace by id", async () => {
    const result = await callTool("activate_workspace", { workspace_id: "2" });
    expect(vi.mocked(activateWorkspace)).toHaveBeenCalledWith("2");
    expect(result.content[0].text).toContain("Other");
  });
});

// ---------------------------------------------------------------------------
// New tools – Import / Export
// ---------------------------------------------------------------------------

describe("MCP tool: export_model", () => {
  it("returns XML string", async () => {
    const result = await callTool("export_model");
    expect(vi.mocked(exportModelToXml)).toHaveBeenCalledWith(1);
    expect(result.content[0].text).toContain("<model/>");
  });
});

describe("MCP tool: import_model", () => {
  it("imports XML and returns model info", async () => {
    const result = await callTool("import_model", { xml: "<model/>" });
    expect(vi.mocked(importModelFromXml)).toHaveBeenCalledWith(1, "<model/>");
    expect(result.content[0].text).toContain("Imported");
  });
});

// ---------------------------------------------------------------------------
// New tools – Viewpoints
// ---------------------------------------------------------------------------

describe("MCP tool: list_viewpoints", () => {
  it("returns sorted list of viewpoints", async () => {
    const result = await callTool("list_viewpoints");
    const vps = JSON.parse(result.content[0].text) as string[];
    expect(vps).toContain("Layered");
    expect(vps).toEqual([...vps].sort());
  });
});
