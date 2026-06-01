import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const clearCookie = () => {};
import {
  viewImageUrl, fetchElements, fetchRelationships,
  fetchModel, fetchElementTypes, fetchRelationshipTypes, fetchViews, fetchView,
  createElement, updateElement, deleteElement,
  createRelationship, updateRelationship, deleteRelationship,
  createView, updateView, deleteView,
  createViewNode, updateViewNode, deleteViewNode,
  createViewConnection, updateViewConnection, deleteViewConnection,
  saveModel, importModel,
  fetchUsers, updateUserApi, deleteUserApi, createUser,
  fetchPropertyDefinitions, createPropertyDefinition, updatePropertyDefinition, deletePropertyDefinition,
  fetchWorkspaces, createWorkspaceApi, updateWorkspaceApi, deleteWorkspaceApi, activateWorkspaceApi,
  fetchRoleCatalog, fetchRoles, fetchRole, createRole, updateRole, deleteRole,
  assignUserToRole, unassignUserFromRole, fetchUserRoles,
  fetchRoleLayers, fetchRoleLayer, setRoleLayer, removeRoleLayer,
  fetchViewpoints,
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
// Roles & permissions
// ---------------------------------------------------------------------------

describe("role queries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchRoleCatalog returns layers and flags", async () => {
    mockFetchOk({ layers: ["Business"], flags: ["read"] });
    const c = await fetchRoleCatalog();
    expect(c.layers).toContain("Business");
  });

  it("fetchRoles returns role list", async () => {
    mockFetchOk([{ id: "r1", name: "admin", is_system: true, permissions: {}, user_ids: [] }]);
    const roles = await fetchRoles();
    expect(roles[0]!.id).toBe("r1");
  });

  it("fetchRole returns a single role", async () => {
    mockFetchOk({ id: "r1", name: "admin", is_system: true, permissions: {}, user_ids: [] });
    const r = await fetchRole("r1");
    expect(r.id).toBe("r1");
  });
});

describe("role mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createRole posts", async () => {
    mockFetchOk({ id: "r2", name: "editor", is_system: false, permissions: {}, user_ids: [] });
    const r = await createRole({ name: "editor" });
    expect(r.name).toBe("editor");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/roles"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updateRole puts", async () => {
    mockFetchOk({ id: "r2", name: "editor-v2", is_system: false, permissions: {}, user_ids: [] });
    const r = await updateRole("r2", { name: "editor-v2" });
    expect(r.name).toBe("editor-v2");
  });

  it("deleteRole sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteRole("r2");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/roles/r2"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("role-user assignment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("assignUserToRole sends PUT", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await assignUserToRole("r1", "u1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/roles/r1/users/u1"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("assignUserToRole throws on error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Not found" }),
    }));
    await expect(assignUserToRole("bad", "u1")).rejects.toThrow("Not found");
  });

  it("unassignUserFromRole sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await unassignUserFromRole("r1", "u1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/roles/r1/users/u1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("fetchUserRoles returns roles for user", async () => {
    mockFetchOk([{ id: "r1", name: "admin", is_system: true, permissions: {}, user_ids: [] }]);
    const roles = await fetchUserRoles("u1");
    expect(roles[0]!.id).toBe("r1");
  });
});

describe("role layer permissions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchRoleLayers returns permissions map", async () => {
    mockFetchOk({ Business: ["read"], Application: [] });
    const perms = await fetchRoleLayers("r1");
    expect(perms.Business).toContain("read");
  });

  it("fetchRoleLayer returns a single layer permission", async () => {
    mockFetchOk({ layer: "Business", permissions: ["read"] });
    const p = await fetchRoleLayer("r1", "Business");
    expect(p.layer).toBe("Business");
  });

  it("setRoleLayer puts layer permission", async () => {
    mockFetchOk({ layer: "Business", permissions: ["read", "create"] });
    const p = await setRoleLayer("r1", "Business", ["read", "create"]);
    expect(p.permissions).toContain("read");
  });

  it("removeRoleLayer sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await removeRoleLayer("r1", "Business");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/roles/r1/layers/Business"),
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
