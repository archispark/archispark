import { describe, it, expect, vi, beforeEach } from "vitest";
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
  return {
    handleReq,
    setOnInit: (fn: (id: string) => void) => { onInit = fn; },
    callOnInit: (id: string) => { if (onInit) onInit(id); },
  };
});

// ---------------------------------------------------------------------------
// Mock mcp-archimate
// ---------------------------------------------------------------------------

vi.mock("mcp-archimate/package.json", () => ({ default: { version: "0.0.0-test" } }));

vi.mock("mcp-archimate/src/registry.js", () => ({
  dataSource: { model: null, db: null, workspaceDbId: 1 },
}));

vi.mock("mcp-archimate/src/app.js", () => ({
  getModelInfo: vi.fn().mockReturnValue({ identifier: "m1", name: "Test" }),
  listElementTypes: vi.fn().mockReturnValue(["ApplicationComponent"]),
  listElements: vi.fn().mockReturnValue([]),
  getElementById: vi.fn().mockReturnValue(null),
  listRelationshipTypes: vi.fn().mockReturnValue(["Association"]),
  listRelationships: vi.fn().mockReturnValue([]),
  getRelationshipById: vi.fn().mockReturnValue(null),
  listViews: vi.fn().mockReturnValue([]),
  getViewById: vi.fn().mockReturnValue(null),
  createView: vi.fn().mockReturnValue({ identifier: "v1" }),
  createNode: vi.fn().mockReturnValue({ identifier: "n1" }),
  createElement: vi.fn().mockReturnValue({ identifier: "e1" }),
  updateElement: vi.fn().mockReturnValue({ identifier: "e1" }),
  deleteElement: vi.fn(),
  createRelationship: vi.fn().mockReturnValue({ identifier: "r1" }),
  updateRelationship: vi.fn().mockReturnValue({ identifier: "r1" }),
  deleteRelationship: vi.fn(),
  saveModel: vi.fn().mockReturnValue({ saved: true, path: "/data/test.xml" }),
  listPropertyDefinitions: vi.fn().mockReturnValue([]),
  getPropertyDefinitionById: vi.fn().mockReturnValue(null),
  createPropertyDefinition: vi.fn().mockReturnValue({ identifier: "pd1" }),
  updatePropertyDefinition: vi.fn().mockReturnValue({ identifier: "pd1" }),
  deletePropertyDefinition: vi.fn(),
}));

vi.mock("mcp-archimate/src/renderer.js", () => ({
  renderViewToSvg: vi.fn().mockReturnValue("<svg/>"),
  renderViewToPng: vi.fn().mockResolvedValue(Buffer.from("png")),
}));

vi.mock("mcp-archimate/src/schemas.js", () => ({
  ELEMENT_TYPES: new Set(["ApplicationComponent", "BusinessActor"]),
  RELATIONSHIP_TYPES: new Set(["Association", "Realization"]),
  PROPERTY_DEFINITION_TYPES: new Set(["string", "number"]),
}));

// ---------------------------------------------------------------------------
// Mock MCP SDK — use regular functions so `new` works (arrow fns can't be `new`-ed)
// ---------------------------------------------------------------------------

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  McpServer: vi.fn().mockImplementation(function McpServerMock(this: any) {
    this.registerTool = vi.fn();
    this.connect = vi.fn().mockImplementation(async () => shared.callOnInit("test-session-abc"));
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StreamableHTTPServerTransport: vi.fn().mockImplementation(function TransportMock(this: any, opts: any) {
    shared.setOnInit(opts.onsessioninitialized);
    this.handleRequest = shared.handleReq;
  }),
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  isInitializeRequest: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { app } from "./server.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Helper: POST initialize to create a session
// ---------------------------------------------------------------------------

async function initSession(): Promise<void> {
  vi.mocked(isInitializeRequest).mockReturnValueOnce(true);
  await request(app).post("/mcp/").send({ method: "initialize", params: {} });
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

describe("POST /mcp/", () => {
  beforeEach(() => {
    vi.mocked(isInitializeRequest).mockReturnValue(false);
    shared.handleReq.mockClear();
  });

  it("returns 400 when no session and body is not an initialize request", async () => {
    const res = await request(app).post("/mcp/").send({ method: "tools/call" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/session/i);
  });

  it("returns 400 when unknown session-id and body is not initialize", async () => {
    const res = await request(app)
      .post("/mcp/")
      .set("mcp-session-id", "unknown-session")
      .send({ method: "tools/call" });
    expect(res.status).toBe(400);
  });

  it("handles initialize request — creates session, calls transport.handleRequest", async () => {
    vi.mocked(isInitializeRequest).mockReturnValueOnce(true);
    const res = await request(app).post("/mcp/").send({ method: "initialize", params: {} });
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });

  it("reuses existing session when mcp-session-id header matches", async () => {
    await initSession();
    shared.handleReq.mockClear();

    const res = await request(app)
      .post("/mcp/")
      .set("mcp-session-id", "test-session-abc")
      .send({ method: "tools/call" });
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });
});

describe("GET /mcp/", () => {
  beforeEach(() => shared.handleReq.mockClear());

  it("returns 405 when no mcp-session-id header", async () => {
    const res = await request(app).get("/mcp/");
    expect(res.status).toBe(405);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it("returns 405 when session-id does not exist in store", async () => {
    const res = await request(app).get("/mcp/").set("mcp-session-id", "ghost");
    expect(res.status).toBe(405);
  });

  it("delegates to transport.handleRequest when session exists", async () => {
    await initSession();
    shared.handleReq.mockClear();

    const res = await request(app).get("/mcp/").set("mcp-session-id", "test-session-abc");
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });
});

describe("DELETE /mcp/", () => {
  beforeEach(() => shared.handleReq.mockClear());

  it("returns 404 when no mcp-session-id header", async () => {
    const res = await request(app).delete("/mcp/");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it("returns 404 when session-id does not exist in store", async () => {
    const res = await request(app).delete("/mcp/").set("mcp-session-id", "unknown");
    expect(res.status).toBe(404);
  });

  it("delegates to transport and removes session from store", async () => {
    await initSession();
    shared.handleReq.mockClear();

    const res = await request(app).delete("/mcp/").set("mcp-session-id", "test-session-abc");
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();

    // session purged — next delete returns 404
    const res2 = await request(app).delete("/mcp/").set("mcp-session-id", "test-session-abc");
    expect(res2.status).toBe(404);
  });
});
