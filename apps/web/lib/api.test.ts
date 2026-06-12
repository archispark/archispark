import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const clearCookie = () => {};
import {
  viewImageUrl, fetchElements, fetchRelationships,
  fetchModel, fetchElementTypes, fetchRelationshipTypes, fetchViews, fetchView,
  fetchElement, fetchElementRelationships, fetchElementViews, fetchElementsInViews,
  fetchRelationship, fetchRelationshipViews,
  createElement, updateElement, deleteElement,
  createRelationship, updateRelationship, deleteRelationship,
  createView, updateView, deleteView,
  createViewNode, updateViewNode, deleteViewNode,
  createViewConnection, updateViewConnection, deleteViewConnection,
  saveModel, importModel,
  fetchUsers, updateUserApi, deleteUserApi, createUser,
  fetchPropertyDefinitions, createPropertyDefinition, updatePropertyDefinition, deletePropertyDefinition,
  fetchWorkspaces, createWorkspaceApi, updateWorkspaceApi, deleteWorkspaceApi, activateWorkspaceApi,
  fetchViewpoints,
  fetchProviders, createProvider, updateProvider, deleteProvider,
  fetchRedisStatus, fetchPostgresStatus,
  fetchApiTokens, createApiToken, deleteApiToken,
  fetchSiteMessages, updateSiteMessages,
} from "./api";

describe("viewImageUrl", () => {
  it("generates SVG URL by default", () => {
    const url = viewImageUrl("view-1");
    expect(url).toContain("view-1");
    expect(url).toContain("format=svg");
  });

  it("encodes special characters in id", () => {
    const url = viewImageUrl("view/with spaces");
    expect(url).not.toContain(" ");
  });
});

describe("fetchElements", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ identifier: "e1", name: "App", type: "ApplicationComponent" }],
    }));
    clearCookie();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookie();
  });

  it("fetches without filters", async () => {
    const result = await fetchElements();
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("ApplicationComponent");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements"),
      expect.any(Object)
    );
  });

  it("adds type query param when provided", async () => {
    await fetchElements("BusinessActor");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("type=BusinessActor"),
      expect.any(Object)
    );
  });

  it("adds name query param when provided", async () => {
    await fetchElements(null, "Search");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("name=Search"),
      expect.any(Object)
    );
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchElements()).rejects.toThrow("API error: 500");
  });
});

describe("fetchRelationships", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
    clearCookie();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookie();
  });

  it("fetches without filters", async () => {
    const result = await fetchRelationships();
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds type query param", async () => {
    await fetchRelationships("Association");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("type=Association"),
      expect.any(Object)
    );
  });
});


// ---------------------------------------------------------------------------
// GET helpers
// ---------------------------------------------------------------------------

function mockFetchOk(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
}

function mockFetchError(status = 500) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ detail: `HTTP ${status}` }),
  }));
}

describe("GET functions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchModel returns model info", async () => {
    mockFetchOk({ identifier: "m1", name: "Model", element_count: 0, relationship_count: 0, view_count: 0, documentation: null, version: null, workspace_id: null, workspace_name: null });
    const m = await fetchModel();
    expect(m.identifier).toBe("m1");
  });

  it("fetchElementTypes returns string array", async () => {
    mockFetchOk(["ApplicationComponent", "BusinessActor"]);
    const types = await fetchElementTypes();
    expect(types).toContain("ApplicationComponent");
  });

  it("fetchRelationshipTypes returns string array", async () => {
    mockFetchOk(["Association", "Realization"]);
    const types = await fetchRelationshipTypes();
    expect(types).toContain("Association");
  });

  it("fetchViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1", documentation: null }]);
    const views = await fetchViews();
    expect(views[0]!.identifier).toBe("v1");
  });

  it("fetchView returns view detail", async () => {
    mockFetchOk({ identifier: "v1", name: "View 1", documentation: null, nodes: [], connections: [] });
    const v = await fetchView("v1");
    expect(v.identifier).toBe("v1");
    expect(v.nodes).toEqual([]);
  });

  it("fetchUsers returns user list", async () => {
    mockFetchOk([{ id: "u1", username: "admin", role: "admin", created_at: "2024-01-01" }]);
    const users = await fetchUsers();
    expect(users[0]!.username).toBe("admin");
  });

  it("fetchPropertyDefinitions returns definitions", async () => {
    mockFetchOk([{ identifier: "pd1", name: "Cost", type: "string" }]);
    const defs = await fetchPropertyDefinitions();
    expect(defs[0]!.identifier).toBe("pd1");
  });

  it("fetchWorkspaces returns workspace list", async () => {
    mockFetchOk([{ id: "ws1", name: "Default", path: "/data", active: true }]);
    const ws = await fetchWorkspaces();
    expect(ws[0]!.name).toBe("Default");
  });

  it("throws API error on non-ok GET", async () => {
    mockFetchError(404);
    await expect(fetchViews()).rejects.toThrow("API error: 404");
  });
});

// ---------------------------------------------------------------------------
// Element mutations
// ---------------------------------------------------------------------------

describe("element mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createElement posts and returns element", async () => {
    mockFetchOk({ identifier: "e1", name: "App", type: "ApplicationComponent", documentation: null, properties: [] });
    const el = await createElement({ name: "App", type: "ApplicationComponent" });
    expect(el.identifier).toBe("e1");
  });

  it("updateElement puts and returns element", async () => {
    mockFetchOk({ identifier: "e1", name: "Updated", type: "ApplicationComponent", documentation: null, properties: [] });
    const el = await updateElement("e1", { name: "Updated" });
    expect(el.name).toBe("Updated");
  });

  it("deleteElement sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteElement("e1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("updateElement throws on error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Not found" }),
    }));
    await expect(updateElement("bad", { name: "x" })).rejects.toThrow("Not found");
  });

  it("deleteElement throws when non-ok with no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error("parse fail"); },
    }));
    await expect(deleteElement("bad")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Relationship mutations
// ---------------------------------------------------------------------------

describe("relationship mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createRelationship posts and returns relationship", async () => {
    mockFetchOk({ identifier: "r1", name: "Rel", type: "Association", source: "e1", target: "e2", documentation: null, properties: [] });
    const rel = await createRelationship({ type: "Association", source: "e1", target: "e2" });
    expect(rel.identifier).toBe("r1");
  });

  it("updateRelationship puts", async () => {
    mockFetchOk({ identifier: "r1", name: "Updated", type: "Association", source: "e1", target: "e2", documentation: null, properties: [] });
    const rel = await updateRelationship("r1", { name: "Updated" });
    expect(rel.name).toBe("Updated");
  });

  it("deleteRelationship sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteRelationship("r1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// View mutations
// ---------------------------------------------------------------------------

describe("view mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createView posts and returns view", async () => {
    mockFetchOk({ identifier: "v1", name: "New View", documentation: null });
    const v = await createView({ name: "New View" });
    expect(v.identifier).toBe("v1");
  });

  it("updateView puts", async () => {
    mockFetchOk({ identifier: "v1", name: "Renamed", documentation: null });
    const v = await updateView("v1", { name: "Renamed" });
    expect(v.name).toBe("Renamed");
  });

  it("deleteView sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteView("v1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Other mutations
// ---------------------------------------------------------------------------

describe("saveModel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts and returns saved status", async () => {
    mockFetchOk({ saved: true, path: "/data/model.xml" });
    const res = await saveModel();
    expect(res.saved).toBe(true);
  });
});

describe("importModel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts XML file and returns model info", async () => {
    mockFetchOk({ identifier: "m1", name: "Imported", element_count: 5, relationship_count: 2, view_count: 1, documentation: null, version: null, workspace_id: null, workspace_name: null });
    const file = new File(["<xml/>"], "model.xml", { type: "text/xml" });
    const m = await importModel(file);
    expect(m.identifier).toBe("m1");
  });

  it("throws on import error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Invalid XML" }),
    }));
    const file = new File(["<bad>"], "model.xml", { type: "text/xml" });
    await expect(importModel(file)).rejects.toThrow("Invalid XML");
  });
});

// ---------------------------------------------------------------------------
// User mutations
// ---------------------------------------------------------------------------

describe("user mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updateUserApi puts", async () => {
    mockFetchOk({ id: "u2", username: "bob", role: "user", created_at: "2024-01-01" });
  });

  it("updateUserApi puts", async () => {
    mockFetchOk({ id: "u2", username: "bob", role: "admin", created_at: "2024-01-01" });
    const u = await updateUserApi("u2", { role: "admin" });
    expect(u.role).toBe("admin");
  });

  it("deleteUserApi sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteUserApi("u2");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users/u2"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Property definition mutations
// ---------------------------------------------------------------------------

describe("property definition mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createPropertyDefinition posts", async () => {
    mockFetchOk({ identifier: "pd1", name: "Cost", type: "string" });
    const pd = await createPropertyDefinition({ name: "Cost" });
    expect(pd.identifier).toBe("pd1");
  });

  it("updatePropertyDefinition puts", async () => {
    mockFetchOk({ identifier: "pd1", name: "Updated", type: "string" });
    const pd = await updatePropertyDefinition("pd1", { name: "Updated" });
    expect(pd.name).toBe("Updated");
  });

  it("deletePropertyDefinition sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deletePropertyDefinition("pd1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/property-definitions/pd1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Workspace mutations
// ---------------------------------------------------------------------------

describe("workspace mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createWorkspaceApi posts", async () => {
    mockFetchOk({ id: "ws2", name: "New WS", path: "/data", active: false });
    const ws = await createWorkspaceApi({ name: "New WS" });
    expect(ws.name).toBe("New WS");
  });

  it("updateWorkspaceApi puts", async () => {
    mockFetchOk({ id: "ws2", name: "Renamed", path: "/data", active: false });
    const ws = await updateWorkspaceApi("ws2", { name: "Renamed" });
    expect(ws.name).toBe("Renamed");
  });

  it("deleteWorkspaceApi sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteWorkspaceApi("ws2");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/ws2"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("activateWorkspaceApi posts to activate endpoint", async () => {
    mockFetchOk({ id: "ws2", name: "WS", path: "/data", active: true });
    const ws = await activateWorkspaceApi("ws2");
    expect(ws.active).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/ws2/activate"),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// View node mutations
// ---------------------------------------------------------------------------

describe("view node mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createViewNode posts to /views/:id/nodes", async () => {
    mockFetchOk({ identifier: "n1", element_ref: "e1", x: 10, y: 20, w: 120, h: 60, name: null, children: [] });
    const n = await createViewNode("v1", { element_id: "e1", x: 10, y: 20, w: 120, h: 60 });
    expect(n.identifier).toBe("n1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/nodes"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updateViewNode puts to /views/:id/nodes/:nid", async () => {
    mockFetchOk({ identifier: "n1", element_ref: "e1", x: 50, y: 60, w: 120, h: 60, name: null, children: [] });
    const n = await updateViewNode("v1", "n1", { x: 50, y: 60 });
    expect(n.x).toBe(50);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/nodes/n1"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("deleteViewNode sends DELETE to /views/:id/nodes/:nid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteViewNode("v1", "n1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/nodes/n1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// View connection mutations
// ---------------------------------------------------------------------------

describe("view connection mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createViewConnection posts to /views/:id/connections", async () => {
    mockFetchOk({ identifier: "c1", source: "n1", target: "n2", name: null, relationship_ref: null });
    const c = await createViewConnection("v1", { source: "n1", target: "n2" });
    expect(c.identifier).toBe("c1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/connections"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updateViewConnection puts to /views/:id/connections/:cid", async () => {
    mockFetchOk({ identifier: "c1", source: "n1", target: "n2", name: "Flow", relationship_ref: null });
    const c = await updateViewConnection("v1", "c1", { name: "Flow" });
    expect(c.name).toBe("Flow");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/connections/c1"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("deleteViewConnection sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteViewConnection("v1", "c1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/connections/c1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// User create & misc
// ---------------------------------------------------------------------------

describe("createUser and fetchViewpoints", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createUser posts", async () => {
    mockFetchOk({ id: "u3", username: "newuser", role: "user", created_at: "2024-01-01" });
    const u = await createUser({ username: "newuser", password: "pass123" });
    expect(u.username).toBe("newuser");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("fetchViewpoints returns array", async () => {
    mockFetchOk(["Layered", "Application Usage"]);
    const vps = await fetchViewpoints();
    expect(vps).toContain("Layered");
  });
});

// ---------------------------------------------------------------------------
// Element detail helpers (previously uncovered)
// ---------------------------------------------------------------------------

describe("element detail helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchElement returns element detail", async () => {
    mockFetchOk({ identifier: "e1", name: "App", type: "ApplicationComponent", documentation: null, properties: [] });
    const el = await fetchElement("e1");
    expect(el.identifier).toBe("e1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1"),
      expect.any(Object)
    );
  });

  it("fetchElementRelationships returns relationships", async () => {
    mockFetchOk([{ identifier: "r1", type: "Association", source: "e1", target: "e2" }]);
    const rels = await fetchElementRelationships("e1");
    expect(rels[0]!.identifier).toBe("r1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1/relationships"),
      expect.any(Object)
    );
  });

  it("fetchElementViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1" }]);
    const views = await fetchElementViews("e1");
    expect(views[0]!.identifier).toBe("v1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1/views"),
      expect.any(Object)
    );
  });

  it("fetchElementsInViews returns id array", async () => {
    mockFetchOk(["e1", "e2"]);
    const ids = await fetchElementsInViews();
    expect(ids).toContain("e1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/in-views"),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// Relationship detail helpers
// ---------------------------------------------------------------------------

describe("relationship detail helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchRelationship returns relationship detail", async () => {
    mockFetchOk({ identifier: "r1", name: null, type: "Association", source: "e1", target: "e2", documentation: null, properties: [] });
    const rel = await fetchRelationship("r1");
    expect(rel.identifier).toBe("r1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1"),
      expect.any(Object)
    );
  });

  it("fetchRelationshipViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1" }]);
    const views = await fetchRelationshipViews("r1");
    expect(views[0]!.identifier).toBe("v1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1/views"),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// OAuth Provider mutations
// ---------------------------------------------------------------------------

describe("OAuth provider mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchProviders returns provider list", async () => {
    mockFetchOk([{ id: "p1", provider_id: "google", type: "google", name: "Google", client_id: "cid", issuer_url: null, tenant_id: null, enabled: true, created_at: 0 }]);
    const providers = await fetchProviders();
    expect(providers[0]!.id).toBe("p1");
  });

  it("createProvider posts and returns provider", async () => {
    mockFetchOk({ id: "p1", provider_id: "google", type: "google", name: "Google", client_id: "cid", issuer_url: null, tenant_id: null, enabled: true, created_at: 0 });
    const p = await createProvider({ type: "google", name: "Google", client_id: "cid", client_secret: "secret" });
    expect(p.id).toBe("p1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/providers"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updateProvider puts and returns provider", async () => {
    mockFetchOk({ id: "p1", provider_id: "google", type: "google", name: "Updated", client_id: "cid", issuer_url: null, tenant_id: null, enabled: true, created_at: 0 });
    const p = await updateProvider("p1", { name: "Updated" });
    expect(p.name).toBe("Updated");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/providers/p1"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("deleteProvider sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteProvider("p1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/providers/p1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("updateProvider throws when PUT fails and json parse also fails (covers .catch branch)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("parse fail"); },
    }));
    await expect(updateProvider("p1", { name: "X" })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Settings — Redis, Postgres
// ---------------------------------------------------------------------------

describe("settings status helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchRedisStatus returns redis status", async () => {
    mockFetchOk({ connected: true, host: "localhost", port: 6379 });
    const status = await fetchRedisStatus();
    expect(status.connected).toBe(true);
  });

  it("fetchPostgresStatus returns postgres status", async () => {
    mockFetchOk({ connected: true, host: "localhost", port: 5432, database: "app", version: "14" });
    const status = await fetchPostgresStatus();
    expect(status.connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// API Tokens
// ---------------------------------------------------------------------------

describe("API token mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchApiTokens returns token list", async () => {
    mockFetchOk([{ id: 1, name: "CI", user_id: "u1", created_at: 0, last_used_at: null, expires_at: null }]);
    const tokens = await fetchApiTokens();
    expect(tokens[0]!.name).toBe("CI");
  });

  it("createApiToken posts without expiresAt", async () => {
    mockFetchOk({ id: 2, name: "My Token", user_id: "u1", created_at: 0, last_used_at: null, expires_at: null, token: "tok-abc" });
    const t = await createApiToken("My Token");
    expect(t.token).toBe("tok-abc");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/api-tokens"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("createApiToken posts with expiresAt (covers ?? branch)", async () => {
    mockFetchOk({ id: 3, name: "Expiring", user_id: "u1", created_at: 0, last_used_at: null, expires_at: 9999, token: "tok-exp" });
    const t = await createApiToken("Expiring", 9999);
    expect(t.expires_at).toBe(9999);
  });

  it("deleteApiToken sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteApiToken(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/api-tokens/1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Site messages
// ---------------------------------------------------------------------------

describe("site messages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchSiteMessages returns site messages", async () => {
    mockFetchOk({ login_message: "Welcome", login_message_enabled: true, banner_message: null, banner_message_enabled: false });
    const msgs = await fetchSiteMessages();
    expect(msgs.login_message).toBe("Welcome");
  });

  it("updateSiteMessages puts and returns ok", async () => {
    mockFetchOk({ ok: true });
    const res = await updateSiteMessages({ login_message: "Hi", login_message_enabled: false, banner_message: null, banner_message_enabled: false });
    expect(res.ok).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/messages"),
      expect.objectContaining({ method: "PUT" })
    );
  });
});

// ---------------------------------------------------------------------------
// POST error handling — json parse failure in post() (covers lines 154-155)
// ---------------------------------------------------------------------------

describe("POST error handling — json parse failure", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createElement throws with fallback message when POST fails and json parse also fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error("parse fail"); },
    }));
    await expect(createElement({ name: "App", type: "ApplicationComponent" })).rejects.toThrow("HTTP 503");
  });

  it("createElement throws with err.detail when POST fails with parseable json but no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    }));
    await expect(createElement({ name: "App", type: "ApplicationComponent" })).rejects.toThrow("API error: 400");
  });
});

// ---------------------------------------------------------------------------
// fetchRelationships — name param branch (line 132)
// ---------------------------------------------------------------------------

describe("fetchRelationships with name param", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes name query param when provided", async () => {
    mockFetchOk([]);
    await fetchRelationships(undefined, "MyRel");
    const url = (vi.mocked(fetch).mock.calls[0]![0] as string);
    expect(url).toContain("name=MyRel");
  });

  it("passes both type and name query params when both provided", async () => {
    mockFetchOk([]);
    await fetchRelationships("Association", "Link");
    const url = (vi.mocked(fetch).mock.calls[0]![0] as string);
    expect(url).toContain("type=Association");
    expect(url).toContain("name=Link");
  });
});

// ---------------------------------------------------------------------------
// PUT error handling — json parse branches (covers lines 190-191)
// ---------------------------------------------------------------------------

describe("PUT error handling branches", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updateElement throws fallback when PUT fails and json has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({}),
    }));
    await expect(updateElement("e1", { name: "X" })).rejects.toThrow("API error: 422");
  });
});

// ---------------------------------------------------------------------------
// DELETE error handling — json parse branches (covers lines 199-200)
// ---------------------------------------------------------------------------

describe("DELETE error handling branches", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("deleteElement throws with fallback message when DELETE fails and json parse also fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("parse fail"); },
    }));
    await expect(deleteElement("e1")).rejects.toThrow("HTTP 500");
  });

  it("deleteElement throws fallback when DELETE fails and json has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    await expect(deleteElement("e1")).rejects.toThrow("API error: 404");
  });
});

// ---------------------------------------------------------------------------
// importModel error handling — json parse branches (covers lines 317-318)
// ---------------------------------------------------------------------------

describe("importModel error handling branches", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("importModel throws with fallback message when POST fails and json parse also fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => { throw new Error("parse fail"); },
    }));
    const file = new File(["data"], "model.xml", { type: "text/xml" });
    await expect(importModel(file)).rejects.toThrow("HTTP 413");
  });

  it("importModel throws fallback when POST fails and json has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    }));
    const file = new File(["data"], "model.xml", { type: "text/xml" });
    await expect(importModel(file)).rejects.toThrow("API error: 400");
  });
});
