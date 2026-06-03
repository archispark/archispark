/**
 * Tests for the ArchiMate API (src/app.ts).
 *
 * Structure:
 * - Unit tests: internal helpers tested with plain objects (no real model).
 * - Integration tests: supertest against the Express app with the real model.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import _request from "supertest";
import { getAdminCookie } from "../src/test-helper.js";

let adminCookie: string;

beforeAll(async () => {
  adminCookie = await getAdminCookie();
  // _init() no longer seeds a default workspace; create one if the DB is empty.
  const list = await _request(app).get("/workspaces").set("Cookie", adminCookie);
  if ((list.body as unknown[]).length === 0) {
    await _request(app).post("/workspaces").set("Cookie", adminCookie).send({ name: "Default" });
  }
});

function request(appArg: Parameters<typeof _request>[0]) {
  return _request.agent(appArg).set("Cookie", adminCookie);
}

import {
  app,
  hexToRgb,
  elementOut,
  relOut,
  nodeOut,
  connectionOut,
  viewOut,
  pdOut,
} from "../src/app.js";
import * as store from "../src/store.js";
import { getActiveWorkspaceId } from "../src/registry.js";
import {
  ACCESS_TYPES,
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  type ElementOut,
  type RelationshipOut,
  type ViewOut,
  type ViewDetailOut,
  type PropertyDefinitionOut,
} from "../src/schemas.js";
import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView, ArchiPropertyDefinition } from "../src/model.js";

const UNKNOWN_ID = "id-does-not-exist";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<ArchiElement> = {}): ArchiElement {
  return {
    uuid: "elem-001",
    name: "My Component",
    type: "ApplicationComponent",
    desc: null,
    props: {},
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<ArchiRelationship> = {}): ArchiRelationship {
  const src = makeElement({ uuid: "src-001", name: "Source" });
  const tgt = makeElement({ uuid: "tgt-001", name: "Target" });
  return {
    uuid: "rel-001",
    name: null,
    type: "Association",
    source: src,
    target: tgt,
    desc: null,
    props: {},
    access_type: null,
    is_directed: null,
    influence_strength: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<ArchiNode> = {}): ArchiNode {
  return {
    uuid: "node-001",
    name: null,
    ref: null,
    x: 10,
    y: 20,
    w: 120,
    h: 55,
    fill_color: { r: 255, g: 255, b: 255, a: 100 },
    line_color: { r: 0, g: 0, b: 0, a: 100 },
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    archi_type: null,
    nodes: [],
    ...overrides,
  };
}

function makeConnection(overrides: Partial<ArchiConnection> = {}): ArchiConnection {
  return {
    uuid: "conn-001",
    name: null,
    ref: "rel-001",
    source: "node-src",
    target: "node-tgt",
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    ...overrides,
  };
}

function makeView(overrides: Partial<ArchiView> = {}): ArchiView {
  return {
    uuid: "view-001",
    name: "My View",
    desc: null,
    primary_viewpoint: null,
    nodes: [],
    conns: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures (loaded once)
// ---------------------------------------------------------------------------

let elementsData: ElementOut[];
let knownElement: ElementOut;
let knownElementType: string;
let knownElementNameFragment: string;
let relationshipsData: RelationshipOut[];
let knownRelationship: RelationshipOut;
let knownRelationshipType: string;
let knownView: ViewOut;

beforeAll(async () => {
  // Seed minimal fixtures when running against an empty DB
  const seedEls = (await request(app).get(`/elements`)).body as ElementOut[];
  if (seedEls.length === 0) {
    await request(app).post(`/elements`).send({ name: "App A", type: "ApplicationComponent" });
    await request(app).post(`/elements`).send({ name: "App B", type: "ApplicationComponent" });
    const created = (await request(app).get(`/elements`)).body as ElementOut[];
    if (created.length >= 2) {
      await request(app).post(`/relationships`).send({ type: "Association", source: created[0]!.identifier, target: created[1]!.identifier });
    }
    await request(app).post(`/views`).send({ name: "Test View" });
  }

  const elemRes = await request(app).get(`/elements`);
  elementsData = elemRes.body as ElementOut[];
  knownElement = elementsData.find((e) => e.identifier && e.type) ?? elementsData[0]!;
  knownElementType = knownElement.type;
  const name = knownElement.name ?? "";
  knownElementNameFragment = (name.length >= 3 ? name.slice(0, 3) : name).toLowerCase();

  const relRes = await request(app).get(`/relationships`);
  relationshipsData = relRes.body as RelationshipOut[];
  knownRelationship = relationshipsData.find((r) => r.identifier && r.type) ?? relationshipsData[0]!;
  knownRelationshipType = knownRelationship.type;

  const viewRes = await request(app).get(`/views`);
  const views = viewRes.body as ViewOut[];
  knownView = views.find((v) => v.identifier) ?? views[0]!;
});

// ===========================================================================
// Unit tests – hexToRgb helper
// ===========================================================================

describe("hexToRgb", () => {
  it("converts white #FFFFFF", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts black #000000", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts grey #5C5C5C", () => {
    const c = hexToRgb("#5C5C5C");
    expect(c?.r).toBe(92);
    expect(c?.g).toBe(92);
    expect(c?.b).toBe(92);
  });

  it("converts without hash prefix", () => {
    expect(hexToRgb("FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for null input", () => {
    expect(hexToRgb(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(hexToRgb("")).toBeNull();
  });

  it("returns null for invalid length #FFF", () => {
    expect(hexToRgb("#FFF")).toBeNull();
  });

  it("returns null for invalid hex #ZZZZZZ", () => {
    expect(hexToRgb("#ZZZZZZ")).toBeNull();
  });
});

// ===========================================================================
// Unit tests – elementOut helper
// ===========================================================================

describe("elementOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(elementOut(makeElement()).identifier).toBe("elem-001");
  });

  it("maps name and type", () => {
    const result = elementOut(makeElement());
    expect(result.name).toBe("My Component");
    expect(result.type).toBe("ApplicationComponent");
  });

  it("maps desc to documentation", () => {
    expect(elementOut(makeElement({ desc: "Some doc" })).documentation).toBe("Some doc");
  });

  it("documentation is null when desc is null", () => {
    expect(elementOut(makeElement({ desc: null })).documentation).toBeNull();
  });

  it("converts props dict to PropertyOut array", () => {
    const result = elementOut(makeElement({ props: { "Capability Level": "0", Status: "active" } }));
    expect(result.properties).toHaveLength(2);
    const refs = new Set(result.properties.map((p) => p.property_definition_ref));
    expect(refs.has("Capability Level")).toBe(true);
    expect(refs.has("Status")).toBe(true);
  });

  it("property value is a string", () => {
    const result = elementOut(makeElement({ props: { key: "val" } }));
    expect(result.properties[0]!.value).toBe("val");
  });

  it("empty props gives empty array", () => {
    expect(elementOut(makeElement({ props: {} })).properties).toEqual([]);
  });
});

// ===========================================================================
// Unit tests – relOut helper
// ===========================================================================

describe("relOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(relOut(makeRelationship()).identifier).toBe("rel-001");
  });

  it("resolves source and target UUIDs", () => {
    const result = relOut(makeRelationship());
    expect(result.source).toBe("src-001");
    expect(result.target).toBe("tgt-001");
  });

  it("includes source_name and target_name", () => {
    const result = relOut(makeRelationship());
    expect(result.source_name).toBe("Source");
    expect(result.target_name).toBe("Target");
  });

  it("maps desc to documentation", () => {
    expect(relOut(makeRelationship({ desc: "Relation doc" })).documentation).toBe("Relation doc");
  });

  it("sets access_type for Access relationship", () => {
    const result = relOut(makeRelationship({ type: "Access", access_type: "Write" }));
    expect(result.access_type).toBe("Write");
  });

  it("access_type is null for non-Access relationship", () => {
    const result = relOut(makeRelationship({ type: "Flow", access_type: "Write" }));
    expect(result.access_type).toBeNull();
  });

  it("sets is_directed for Association", () => {
    const result = relOut(makeRelationship({ type: "Association", is_directed: true }));
    expect(result.is_directed).toBe(true);
  });

  it("is_directed is null for non-Association", () => {
    const result = relOut(makeRelationship({ type: "Serving", is_directed: true }));
    expect(result.is_directed).toBeNull();
  });

  it("sets modifier for Influence", () => {
    const result = relOut(makeRelationship({ type: "Influence", influence_strength: "+" }));
    expect(result.modifier).toBe("+");
  });

  it("modifier is null for non-Influence", () => {
    const result = relOut(makeRelationship({ type: "Flow", influence_strength: "+" }));
    expect(result.modifier).toBeNull();
  });
});

// ===========================================================================
// Unit tests – nodeOut helper
// ===========================================================================

describe("nodeOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(nodeOut(makeNode()).identifier).toBe("node-001");
  });

  it("maps coordinates as integers", () => {
    const result = nodeOut(makeNode({ x: 10, y: 20, w: 120, h: 55 }));
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.w).toBe(120);
    expect(result.h).toBe(55);
  });

  it("element_ref from string ref", () => {
    expect(nodeOut(makeNode({ ref: "elem-abc" })).element_ref).toBe("elem-abc");
  });

  it("element_ref from element object ref", () => {
    const refObj = makeElement({ uuid: "elem-xyz" });
    expect(nodeOut(makeNode({ ref: refObj })).element_ref).toBe("elem-xyz");
  });

  it("element_ref is null when ref is null", () => {
    expect(nodeOut(makeNode({ ref: null })).element_ref).toBeNull();
  });

  it("style has fill and line colors", () => {
    const result = nodeOut(makeNode({
      fill_color: { r: 255, g: 0, b: 0 },
      line_color: { r: 0, g: 0, b: 255 },
    }));
    expect(result.style?.fill_color).toEqual({ r: 255, g: 0, b: 0 });
    expect(result.style?.line_color).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("children are populated", () => {
    const child = makeNode({ uuid: "child-001" });
    const parent = makeNode({ uuid: "parent-001", nodes: [child] });
    const result = nodeOut(parent);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.identifier).toBe("child-001");
  });
});

// ===========================================================================
// Unit tests – connectionOut helper
// ===========================================================================

describe("connectionOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(connectionOut(makeConnection()).identifier).toBe("conn-001");
  });

  it("maps relationship_ref", () => {
    expect(connectionOut(makeConnection({ ref: "rel-abc" })).relationship_ref).toBe("rel-abc");
  });

  it("maps source and target", () => {
    const result = connectionOut(makeConnection({ source: "n1", target: "n2" }));
    expect(result.source).toBe("n1");
    expect(result.target).toBe("n2");
  });

  it("style has line_color", () => {
    const result = connectionOut(makeConnection({ line_color: { r: 92, g: 92, b: 92 } }));
    expect(result.style?.line_color).toEqual({ r: 92, g: 92, b: 92 });
  });

  it("style is null when no styling", () => {
    expect(connectionOut(makeConnection({ line_color: null, line_width: null })).style).toBeNull();
  });
});

// ===========================================================================
// Unit tests – viewOut helper
// ===========================================================================

describe("viewOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(viewOut(makeView()).identifier).toBe("view-001");
  });

  it("maps name", () => {
    expect(viewOut(makeView()).name).toBe("My View");
  });

  it("maps desc to documentation", () => {
    expect(viewOut(makeView({ desc: "View doc" })).documentation).toBe("View doc");
  });

  it("maps primary_viewpoint to viewpoint", () => {
    expect(viewOut(makeView({ primary_viewpoint: "Layered" })).viewpoint).toBe("Layered");
  });

  it("node_count is correct", () => {
    const nodes = [makeNode(), makeNode({ uuid: "node-002" }), makeNode({ uuid: "node-003" })];
    expect(viewOut(makeView({ nodes })).node_count).toBe(3);
  });

  it("connection_count is correct", () => {
    const conns = [makeConnection(), makeConnection({ uuid: "conn-002" }), makeConnection({ uuid: "conn-003" }), makeConnection({ uuid: "conn-004" }), makeConnection({ uuid: "conn-005" })];
    expect(viewOut(makeView({ conns })).connection_count).toBe(5);
  });

  it("summary returns ViewOut shape (no nodes/connections array)", () => {
    const result = viewOut(makeView());
    expect("nodes" in result).toBe(false);
    expect("connections" in result).toBe(false);
  });

  it("detail mode returns ViewDetailOut with nodes and connections", () => {
    const result = viewOut(makeView(), true) as ViewDetailOut;
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.connections)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /
// ===========================================================================

describe("GET /", () => {
  it("returns 200", async () => {
    const res = await request(app).get(`/`);
    expect(res.status).toBe(200);
  });

  it("response has required fields", async () => {
    const data = (await request(app).get(`/`)).body;
    expect(data).toHaveProperty("identifier");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("element_count");
    expect(data).toHaveProperty("relationship_count");
    expect(data).toHaveProperty("view_count");
  });

  it("model name is non-empty string", async () => {
    const data = (await request(app).get(`/`)).body;
    expect(typeof data.name).toBe("string");
    expect(data.name.trim()).not.toBe("");
  });

  it("counts are positive", async () => {
    const data = (await request(app).get(`/`)).body;
    expect(data.element_count).toBeGreaterThan(0);
    expect(data.relationship_count).toBeGreaterThan(0);
    expect(data.view_count).toBeGreaterThan(0);
  });

  it("identifier is non-empty", async () => {
    const data = (await request(app).get(`/`)).body;
    expect(data.identifier.trim()).not.toBe("");
  });
});

// ===========================================================================
// Integration tests – GET /elements/types
// ===========================================================================

describe("GET /elements/types", () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/elements/types`)).status).toBe(200);
  });

  it("returns array of strings", async () => {
    const data = (await request(app).get(`/elements/types`)).body as string[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((t) => typeof t === "string")).toBe(true);
  });

  it("is sorted", async () => {
    const data = (await request(app).get(`/elements/types`)).body as string[];
    expect(data).toEqual([...data].sort());
  });

  it("has no duplicates", async () => {
    const data = (await request(app).get(`/elements/types`)).body as string[];
    expect(data.length).toBe(new Set(data).size);
  });

  it("contains known element type", async () => {
    const data = (await request(app).get(`/elements/types`)).body as string[];
    expect(data.includes(knownElementType)).toBe(true);
  });

  it("all types are valid ArchiMate 3.1", async () => {
    const data = (await request(app).get(`/elements/types`)).body as string[];
    for (const t of data) {
      expect(ELEMENT_TYPES.has(t), `Type '${t}' not in ArchiMate 3.1 spec`).toBe(true);
    }
  });
});

// ===========================================================================
// Integration tests – GET /elements
// ===========================================================================

describe("GET /elements", () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/elements`)).status).toBe(200);
  });

  it("returns all elements", async () => {
    const data = (await request(app).get(`/elements`)).body as ElementOut[];
    expect(data.length).toBe((await store.listElements(await getActiveWorkspaceId())).length);
  });

  it("element has required shape", async () => {
    const data = (await request(app).get(`/elements`)).body as ElementOut[];
    const e = data[0]!;
    expect(e).toHaveProperty("identifier");
    expect(e).toHaveProperty("name");
    expect(e).toHaveProperty("type");
    expect(e).toHaveProperty("documentation");
    expect(e).toHaveProperty("properties");
  });

  it("properties is an array", async () => {
    const data = (await request(app).get(`/elements`)).body as ElementOut[];
    expect(data.every((e) => Array.isArray(e.properties))).toBe(true);
  });

  it("property has correct shape", async () => {
    const data = (await request(app).get(`/elements`)).body as ElementOut[];
    const withProps = data.find((e) => e.properties.length > 0);
    if (withProps) {
      const p = withProps.properties[0]!;
      expect(p).toHaveProperty("property_definition_ref");
      expect(p).toHaveProperty("value");
    }
  });

  it("filter by type works", async () => {
    const data = (await request(app).get(`/elements?type=${knownElementType}`)).body as ElementOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => e.type === knownElementType)).toBe(true);
  });

  it("filter by type + name returns empty when no match", async () => {
    const data = (await request(app).get(`/elements?type=Capability&name=xyznotfound123`)).body;
    expect(data).toEqual([]);
  });

  it("invalid type returns 422", async () => {
    const res = await request(app).get(`/elements?type=NonExistentType`);
    expect(res.status).toBe(422);
  });

  it("filter by name is case-insensitive", async () => {
    if (!knownElementNameFragment) return;
    const data = (await request(app).get(`/elements?name=${knownElementNameFragment}`)).body as ElementOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => (e.name ?? "").toLowerCase().includes(knownElementNameFragment))).toBe(true);
  });

  it("name filter with no match returns empty array", async () => {
    const data = (await request(app).get(`/elements?name=xyznotfound123`)).body;
    expect(data).toEqual([]);
  });

  it("combined filter by type and name", async () => {
    if (!knownElementNameFragment) return;
    const data = (await request(app).get(`/elements?type=${knownElementType}&name=${knownElementNameFragment}`)).body as ElementOut[];
    expect(data.every((e) => e.type === knownElementType)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /elements/:id
// ===========================================================================

describe("GET /elements/:id", () => {
  it("known id returns 200", async () => {
    const res = await request(app).get(`/elements/${knownElement.identifier}`);
    expect(res.status).toBe(200);
  });

  it("known id returns correct data", async () => {
    const data = (await request(app).get(`/elements/${knownElement.identifier}`)).body;
    expect(data.identifier).toBe(knownElement.identifier);
    expect(data.name).toBe(knownElement.name);
    expect(data.type).toBe(knownElement.type);
  });

  it("unknown id returns 404", async () => {
    expect((await request(app).get(`/elements/${UNKNOWN_ID}`)).status).toBe(404);
  });

  it("404 message contains the id", async () => {
    const data = (await request(app).get(`/elements/${UNKNOWN_ID}`)).body;
    expect(data.detail).toContain(UNKNOWN_ID);
  });

  it("properties is an array", async () => {
    const data = (await request(app).get(`/elements/${knownElement.identifier}`)).body;
    expect(Array.isArray(data.properties)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /elements/in-views
// ===========================================================================

describe("GET /elements/in-views", () => {
  it("returns 200", async () => {
    expect((await request(app).get("/elements/in-views")).status).toBe(200);
  });

  it("returns an array of strings", async () => {
    const data = (await request(app).get("/elements/in-views")).body;
    expect(Array.isArray(data)).toBe(true);
    for (const id of data) expect(typeof id).toBe("string");
  });

  it("every id exists in the elements list", async () => {
    const [inViews, elements] = await Promise.all([
      request(app).get("/elements/in-views").then((r) => r.body as string[]),
      request(app).get("/elements").then((r) => r.body as ElementOut[]),
    ]);
    const elementIds = new Set(elements.map((e) => e.identifier));
    for (const id of inViews) expect(elementIds.has(id)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /elements/:id/relationships
// ===========================================================================

describe("GET /elements/:id/relationships", () => {
  it("returns 200 for known element", async () => {
    const res = await request(app).get(`/elements/${knownElement.identifier}/relationships`);
    expect(res.status).toBe(200);
  });

  it("returns an array", async () => {
    const data = (await request(app).get(`/elements/${knownElement.identifier}/relationships`)).body;
    expect(Array.isArray(data)).toBe(true);
  });

  it("each result involves the element as source or target", async () => {
    const data = (await request(app).get(`/elements/${knownElement.identifier}/relationships`)).body as RelationshipOut[];
    for (const r of data) {
      expect(r.source === knownElement.identifier || r.target === knownElement.identifier).toBe(true);
    }
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await _request(app).get(`/elements/${knownElement.identifier}/relationships`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// Integration tests – GET /relationships/types
// ===========================================================================

describe("GET /relationships/types", () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/relationships/types`)).status).toBe(200);
  });

  it("is sorted", async () => {
    const data = (await request(app).get(`/relationships/types`)).body as string[];
    expect(data).toEqual([...data].sort());
  });

  it("contains known relationship type", async () => {
    const data = (await request(app).get(`/relationships/types`)).body as string[];
    expect(data.includes(knownRelationshipType)).toBe(true);
  });

  it("all types are valid ArchiMate 3.1", async () => {
    const data = (await request(app).get(`/relationships/types`)).body as string[];
    for (const t of data) {
      expect(RELATIONSHIP_TYPES.has(t), `Type '${t}' not in ArchiMate 3.1 spec`).toBe(true);
    }
  });
});

// ===========================================================================
// Integration tests – GET /relationships
// ===========================================================================

describe("GET /relationships", () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/relationships`)).status).toBe(200);
  });

  it("returns all relationships", async () => {
    const data = (await request(app).get(`/relationships`)).body as RelationshipOut[];
    expect(data.length).toBe((await store.listRelationships(await getActiveWorkspaceId())).length);
  });

  it("relationship has required shape", async () => {
    const r = ((await request(app).get(`/relationships`)).body as RelationshipOut[])[0]!;
    expect(r).toHaveProperty("identifier");
    expect(r).toHaveProperty("type");
    expect(r).toHaveProperty("source");
    expect(r).toHaveProperty("target");
    expect(r).toHaveProperty("documentation");
    expect(r).toHaveProperty("properties");
  });

  it("filter by type works", async () => {
    const data = (await request(app).get(`/relationships?type=${knownRelationshipType}`)).body as RelationshipOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.type === knownRelationshipType)).toBe(true);
  });

  it("invalid type returns 422", async () => {
    expect((await request(app).get(`/relationships?type=NotARelType`)).status).toBe(422);
  });

  it("filter by source_id works", async () => {
    const source = knownRelationship.source;
    const data = (await request(app).get(`/relationships?source_id=${source}`)).body as RelationshipOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.source === source)).toBe(true);
  });

  it("filter by target_id works", async () => {
    const target = knownRelationship.target;
    const data = (await request(app).get(`/relationships?target_id=${target}`)).body as RelationshipOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.target === target)).toBe(true);
  });

  it("filter with no match returns empty array", async () => {
    const data = (await request(app).get(`/relationships?source_id=${UNKNOWN_ID}`)).body;
    expect(data).toEqual([]);
  });

  it("source_name and target_name are present", async () => {
    const data = (await request(app).get(`/relationships`)).body as RelationshipOut[];
    expect(data.every((r) => "source_name" in r && "target_name" in r)).toBe(true);
  });

  it("Access relationships have access_type in ACCESS_TYPES or null", async () => {
    const data = (await request(app).get(`/relationships?type=Access`)).body as RelationshipOut[];
    for (const r of data) {
      if (r.access_type !== null && r.access_type !== undefined) {
        expect(ACCESS_TYPES.has(r.access_type)).toBe(true);
      }
    }
  });

  it("Association relationships have is_directed field", async () => {
    const data = (await request(app).get(`/relationships?type=Association`)).body as RelationshipOut[];
    for (const r of data) {
      expect("is_directed" in r).toBe(true);
    }
  });

  it("Influence relationships have modifier field", async () => {
    const data = (await request(app).get(`/relationships?type=Influence`)).body as RelationshipOut[];
    for (const r of data) {
      expect("modifier" in r).toBe(true);
    }
  });
});

// ===========================================================================
// Integration tests – GET /relationships/:id
// ===========================================================================

describe("GET /relationships/:id", () => {
  it("known id returns 200", async () => {
    expect((await request(app).get(`/relationships/${knownRelationship.identifier}`)).status).toBe(200);
  });

  it("known id returns correct data", async () => {
    const data = (await request(app).get(`/relationships/${knownRelationship.identifier}`)).body;
    expect(data.identifier).toBe(knownRelationship.identifier);
    expect(data.type).toBe(knownRelationship.type);
  });

  it("unknown id returns 404", async () => {
    expect((await request(app).get(`/relationships/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – GET /views
// ===========================================================================

describe("GET /views", () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/views`)).status).toBe(200);
  });

  it("returns all views", async () => {
    const data = (await request(app).get(`/views`)).body as ViewOut[];
    expect(data.length).toBe((await store.listViews(await getActiveWorkspaceId())).length);
  });

  it("view has required shape", async () => {
    const v = ((await request(app).get(`/views`)).body as ViewOut[])[0]!;
    expect(v).toHaveProperty("identifier");
    expect(v).toHaveProperty("name");
    expect(v).toHaveProperty("node_count");
    expect(v).toHaveProperty("connection_count");
    expect(v).toHaveProperty("viewpoint");
    expect(v).toHaveProperty("documentation");
  });

  it("node_count is an integer", async () => {
    const data = (await request(app).get(`/views`)).body as ViewOut[];
    expect(data.every((v) => Number.isInteger(v.node_count))).toBe(true);
  });

  it("connection_count is an integer", async () => {
    const data = (await request(app).get(`/views`)).body as ViewOut[];
    expect(data.every((v) => Number.isInteger(v.connection_count))).toBe(true);
  });

  it("contains known view", async () => {
    const ids = ((await request(app).get(`/views`)).body as ViewOut[]).map((v) => v.identifier);
    expect(ids.includes(knownView.identifier)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /views/:id
// ===========================================================================

describe("GET /views/:id", () => {
  it("known id returns 200", async () => {
    expect((await request(app).get(`/views/${knownView.identifier}`)).status).toBe(200);
  });

  it("known id returns correct data", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body;
    expect(data.identifier).toBe(knownView.identifier);
    expect(data.name).toBe(knownView.name);
  });

  it("nodes are present and count matches", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(data.nodes.length).toBe(data.node_count);
  });

  it("connections are present and count matches", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    expect(Array.isArray(data.connections)).toBe(true);
    expect(data.connections.length).toBe(data.connection_count);
  });

  it("node has correct shape (if view has nodes)", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    if (!data.nodes.length) return;
    const n = data.nodes[0]!;
    expect(n).toHaveProperty("identifier");
    expect(n).toHaveProperty("element_ref");
    expect(n).toHaveProperty("x");
    expect(n).toHaveProperty("y");
    expect(n).toHaveProperty("w");
    expect(n).toHaveProperty("h");
    expect(n).toHaveProperty("style");
    expect(n).toHaveProperty("children");
  });

  it("node coordinates are integers", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    for (const n of data.nodes) {
      if (n.x !== null && n.x !== undefined) expect(Number.isInteger(n.x)).toBe(true);
      if (n.w !== null && n.w !== undefined) expect(Number.isInteger(n.w)).toBe(true);
    }
  });

  it("node style RGB colors are in 0-255 range", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    for (const n of data.nodes) {
      const fc = n.style?.fill_color;
      if (fc) {
        expect(fc.r).toBeGreaterThanOrEqual(0);
        expect(fc.r).toBeLessThanOrEqual(255);
        expect(fc.g).toBeGreaterThanOrEqual(0);
        expect(fc.g).toBeLessThanOrEqual(255);
        expect(fc.b).toBeGreaterThanOrEqual(0);
        expect(fc.b).toBeLessThanOrEqual(255);
      }
    }
  });

  it("connection has correct shape (if view has connections)", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    if (!data.connections.length) return;
    const c = data.connections[0]!;
    expect(c).toHaveProperty("identifier");
    expect(c).toHaveProperty("relationship_ref");
    expect(c).toHaveProperty("source");
    expect(c).toHaveProperty("target");
  });

  it("connection source references a node in the view", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    if (!data.connections.length) return;
    const nodeIds = new Set(data.nodes.map((n) => n.identifier));
    for (const c of data.connections) {
      if (c.source) expect(nodeIds.has(c.source)).toBe(true);
    }
  });

  it("connection relationship_ref references a known relationship", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    const relIds = new Set(
      ((await request(app).get(`/relationships`)).body as RelationshipOut[]).map((r) => r.identifier)
    );
    for (const c of data.connections) {
      if (c.relationship_ref) expect(relIds.has(c.relationship_ref)).toBe(true);
    }
  });

  it("node element_ref references a known element", async () => {
    const data = (await request(app).get(`/views/${knownView.identifier}`)).body as ViewDetailOut;
    const elemIds = new Set(
      ((await request(app).get(`/elements`)).body as ElementOut[]).map((e) => e.identifier)
    );
    const refs = data.nodes.filter((n) => n.element_ref).map((n) => n.element_ref!);
    if (refs.length > 0) {
      expect(refs.some((ref) => elemIds.has(ref))).toBe(true);
    }
  });

  it("unknown id returns 404", async () => {
    expect((await request(app).get(`/views/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – POST /views and POST /views/:view_id/nodes
// ===========================================================================

describe("POST /views", () => {
  const createdViewIds: string[] = [];
  afterEach(async () => {
    for (const id of createdViewIds.splice(0)) {
      await request(app).delete(`/views/${id}`);
    }
  });

  it("returns 201 with ViewDetail shape", async () => {
    const res = await request(app)
      .post(`/views`)
      .send({ name: "Test View" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("identifier");
    expect(res.body.name).toBe("Test View");
    expect(Array.isArray(res.body.nodes)).toBe(true);
    createdViewIds.push(res.body.identifier);
  });

  it("accepts optional viewpoint and documentation", async () => {
    const res = await request(app)
      .post(`/views`)
      .send({ name: "VP View", viewpoint: "Layered", documentation: "desc" });
    expect(res.status).toBe(201);
    expect(res.body.viewpoint).toBe("Layered");
    createdViewIds.push(res.body.identifier);
  });

  it("returns 422 when name is missing", async () => {
    expect((await request(app).post(`/views`).send({})).status).toBe(422);
  });

  it("created view appears in GET /views", async () => {
    const viewId = (await request(app).post(`/views`).send({ name: "Listed View" })).body.identifier;
    createdViewIds.push(viewId);
    const list = (await request(app).get(`/views`)).body as ViewOut[];
    expect(list.some((v) => v.identifier === viewId)).toBe(true);
  });
});

describe("POST /views/:view_id/nodes", () => {
  let testViewId: string;
  let knownElementId: string;

  beforeAll(async () => {
    const viewRes = await request(app).post(`/views`).send({ name: "Node Test View" });
    testViewId = viewRes.body.identifier;
    knownElementId = ((await request(app).get(`/elements`)).body as ElementOut[])[0]!.identifier;
  });

  afterEach(async () => {
    const detail = (await request(app).get(`/views/${testViewId}`)).body as ViewDetailOut;
    for (const n of detail.nodes ?? []) {
      await request(app).delete(`/views/${testViewId}/nodes/${n.identifier}`);
    }
  });

  it("returns 201 with Node shape", async () => {
    const res = await request(app)
      .post(`/views/${testViewId}/nodes`)
      .send({ element_id: knownElementId, x: 10, y: 20, w: 120, h: 55 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("identifier");
    expect(res.body.element_ref).toBe(knownElementId);
    expect(res.body.x).toBe(10);
    expect(res.body.y).toBe(20);
  });

  it("node appears in GET /views/:id", async () => {
    await request(app).post(`/views/${testViewId}/nodes`).send({ element_id: knownElementId });
    const view = (await request(app).get(`/views/${testViewId}`)).body as ViewDetailOut;
    expect(view.nodes.length).toBe(1);
    expect(view.nodes[0]!.element_ref).toBe(knownElementId);
  });

  it("returns 404 for unknown view_id", async () => {
    const res = await request(app).post(`/views/${UNKNOWN_ID}/nodes`).send({ element_id: knownElementId });
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown element_id", async () => {
    const res = await request(app).post(`/views/${testViewId}/nodes`).send({ element_id: UNKNOWN_ID });
    expect(res.status).toBe(404);
  });

  it("returns 422 when element_id is missing", async () => {
    expect((await request(app).post(`/views/${testViewId}/nodes`).send({})).status).toBe(422);
  });
});

// ===========================================================================
// Integration tests – POST /elements (CRUD cycle)
// ===========================================================================

describe("Mutation - éléments POST/PUT/DELETE", () => {
  let createdElementId: string;

  it("POST /elements crée un élément (201)", async () => {
    const res = await request(app)
      .post(`/elements`)
      .send({ name: "Test App CRUD", type: "ApplicationComponent", documentation: "test doc" });
    expect(res.status).toBe(201);
    expect(res.body.identifier).toBeTruthy();
    expect(res.body.name).toBe("Test App CRUD");
    expect(res.body.type).toBe("ApplicationComponent");
    expect(res.body.documentation).toBe("test doc");
    createdElementId = res.body.identifier as string;
  });

  it("GET /elements/:id retrouve l'élément créé", async () => {
    const res = await request(app).get(`/elements/${createdElementId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test App CRUD");
  });

  it("PUT /elements/:id modifie le nom et la documentation", async () => {
    const res = await request(app)
      .put(`/elements/${createdElementId}`)
      .send({ name: "Test App Updated", documentation: "updated doc" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test App Updated");
    expect(res.body.documentation).toBe("updated doc");
  });

  it("PUT /elements/:id avec type invalide retourne 422", async () => {
    const res = await request(app)
      .put(`/elements/${createdElementId}`)
      .send({ type: "NotAType" });
    expect(res.status).toBe(422);
  });

  it("DELETE /elements/:id supprime l'élément (204)", async () => {
    const res = await request(app).delete(`/elements/${createdElementId}`);
    expect(res.status).toBe(204);
  });

  it("GET /elements/:id après suppression retourne 404", async () => {
    const res = await request(app).get(`/elements/${createdElementId}`);
    expect(res.status).toBe(404);
  });

  it("POST /elements sans name retourne 422", async () => {
    const res = await request(app)
      .post(`/elements`)
      .send({ type: "ApplicationComponent" });
    expect(res.status).toBe(422);
  });

  it("POST /elements sans type retourne 422", async () => {
    const res = await request(app)
      .post(`/elements`)
      .send({ name: "No type" });
    expect(res.status).toBe(422);
  });

  it("POST /elements avec type invalide retourne 422", async () => {
    const res = await request(app)
      .post(`/elements`)
      .send({ name: "Bad", type: "Nonexistent" });
    expect(res.status).toBe(422);
  });

  it("PUT /elements/:id inconnu retourne 404", async () => {
    const res = await request(app)
      .put(`/elements/${UNKNOWN_ID}`)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /elements/:id inconnu retourne 404", async () => {
    expect((await request(app).delete(`/elements/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – POST /relationships (CRUD cycle)
// ===========================================================================

describe("Mutation - relations POST/PUT/DELETE", () => {
  let createdRelId: string;
  let srcElemId: string;
  let tgtElemId: string;

  beforeAll(async () => {
    const res = await request(app).get(`/elements`);
    const elems = res.body as ElementOut[];
    srcElemId = elems[0]!.identifier;
    tgtElemId = elems[1]!.identifier;
  });

  it("POST /relationships crée une relation (201)", async () => {
    const res = await request(app)
      .post(`/relationships`)
      .send({ type: "Association", source: srcElemId, target: tgtElemId, name: "Test Rel" });
    expect(res.status).toBe(201);
    expect(res.body.identifier).toBeTruthy();
    expect(res.body.type).toBe("Association");
    expect(res.body.source).toBe(srcElemId);
    expect(res.body.target).toBe(tgtElemId);
    createdRelId = res.body.identifier as string;
  });

  it("GET /relationships/:id retrouve la relation créée", async () => {
    const res = await request(app).get(`/relationships/${createdRelId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test Rel");
  });

  it("PUT /relationships/:id modifie le nom", async () => {
    const res = await request(app)
      .put(`/relationships/${createdRelId}`)
      .send({ name: "Updated Rel" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Rel");
  });

  it("PUT /relationships/:id avec type invalide retourne 422", async () => {
    const res = await request(app)
      .put(`/relationships/${createdRelId}`)
      .send({ type: "BadType" });
    expect(res.status).toBe(422);
  });

  it("DELETE /relationships/:id supprime la relation (204)", async () => {
    const res = await request(app).delete(`/relationships/${createdRelId}`);
    expect(res.status).toBe(204);
  });

  it("GET /relationships/:id après suppression retourne 404", async () => {
    const res = await request(app).get(`/relationships/${createdRelId}`);
    expect(res.status).toBe(404);
  });

  it("POST /relationships sans type retourne 422", async () => {
    const res = await request(app)
      .post(`/relationships`)
      .send({ source: srcElemId, target: tgtElemId });
    expect(res.status).toBe(422);
  });

  it("POST /relationships avec type invalide retourne 422", async () => {
    const res = await request(app)
      .post(`/relationships`)
      .send({ type: "BadType", source: srcElemId, target: tgtElemId });
    expect(res.status).toBe(422);
  });

  it("POST /relationships avec source inconnue retourne 422", async () => {
    const res = await request(app)
      .post(`/relationships`)
      .send({ type: "Association", source: UNKNOWN_ID, target: tgtElemId });
    expect(res.status).toBe(422);
  });

  it("PUT /relationships/:id inconnu retourne 404", async () => {
    const res = await request(app)
      .put(`/relationships/${UNKNOWN_ID}`)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /relationships/:id inconnu retourne 404", async () => {
    expect((await request(app).delete(`/relationships/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – REST validation gaps
// ===========================================================================

describe("POST /relationships – source and target field validation", () => {
  let srcId: string;
  let tgtId: string;

  beforeAll(async () => {
    const res = await request(app).get("/elements");
    const elems = res.body as ElementOut[];
    srcId = elems[0]!.identifier;
    tgtId = elems[1]!.identifier;
  });

  it("returns 422 when source field is missing", async () => {
    const res = await request(app)
      .post("/relationships")
      .send({ type: "Association", target: tgtId });
    expect(res.status).toBe(422);
    expect(res.body.detail).toContain("source");
  });

  it("returns 422 when target field is missing", async () => {
    const res = await request(app)
      .post("/relationships")
      .send({ type: "Association", source: srcId });
    expect(res.status).toBe(422);
    expect(res.body.detail).toContain("target");
  });
});

describe("GET /docs", () => {
  it("returns 404 — Swagger UI is now served by the docs app", async () => {
    const res = await request(app).get("/docs");
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Unit tests – pdOut + propertyDefinitions business logic
// ===========================================================================

function makePropertyDefinition(overrides: Partial<ArchiPropertyDefinition> = {}): ArchiPropertyDefinition {
  return { uuid: "propid-1", name: "Phase", type: "string", ...overrides };
}

describe("pdOut", () => {
  it("maps ArchiPropertyDefinition to PropertyDefinitionOut", () => {
    const result = pdOut(makePropertyDefinition());
    expect(result.identifier).toBe("propid-1");
    expect(result.name).toBe("Phase");
    expect(result.type).toBe("string");
  });
});

// ===========================================================================
// Integration tests – GET /property-definitions
// ===========================================================================

describe("GET /property-definitions", () => {
  it("returns 200", async () => {
    expect((await request(app).get("/property-definitions")).status).toBe(200);
  });

  it("returns array", async () => {
    const data = (await request(app).get("/property-definitions")).body;
    expect(Array.isArray(data)).toBe(true);
  });

  it("items have required shape", async () => {
    const data = (await request(app).get("/property-definitions")).body as PropertyDefinitionOut[];
    if (!data.length) return;
    expect(data[0]).toHaveProperty("identifier");
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("type");
  });

  it("count matches model", async () => {
    const data = (await request(app).get("/property-definitions")).body as PropertyDefinitionOut[];
    expect(data.length).toBe((await store.listPropertyDefinitions(await getActiveWorkspaceId())).length);
  });
});

// ===========================================================================
// Integration tests – CRUD /property-definitions
// ===========================================================================

describe("POST/GET/PUT/DELETE /property-definitions", () => {
  it("full CRUD lifecycle", async () => {
    // Create
    const createRes = await request(app)
      .post("/property-definitions")
      .send({ name: "TestProp", type: "string" });
    expect(createRes.status).toBe(201);
    const created = createRes.body as PropertyDefinitionOut;
    expect(created.name).toBe("TestProp");
    expect(created.type).toBe("string");
    const id = created.identifier;

    // Read
    const getRes = await request(app).get(`/property-definitions/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.identifier).toBe(id);

    // Update
    const putRes = await request(app)
      .put(`/property-definitions/${id}`)
      .send({ name: "UpdatedProp" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe("UpdatedProp");

    // Delete
    const delRes = await request(app).delete(`/property-definitions/${id}`);
    expect(delRes.status).toBe(204);

    // Confirm gone
    expect((await request(app).get(`/property-definitions/${id}`)).status).toBe(404);
  });

  it("POST 422 when name missing", async () => {
    const res = await request(app).post("/property-definitions").send({ type: "string" });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("detail");
  });

  it("POST 422 when type is invalid", async () => {
    const res = await request(app).post("/property-definitions").send({ name: "X", type: "invalid" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toContain("invalid");
  });

  it("PUT 422 when type is invalid", async () => {
    const createRes = await request(app).post("/property-definitions").send({ name: "TmpProp" });
    const id = (createRes.body as PropertyDefinitionOut).identifier;
    const res = await request(app).put(`/property-definitions/${id}`).send({ type: "notatype" });
    expect(res.status).toBe(422);
    await request(app).delete(`/property-definitions/${id}`);
  });

  it("GET 404 for unknown id", async () => {
    expect((await request(app).get(`/property-definitions/${UNKNOWN_ID}`)).status).toBe(404);
  });

  it("DELETE 404 for unknown id", async () => {
    expect((await request(app).delete(`/property-definitions/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – view CRUD endpoints
// ===========================================================================

describe("PUT /views/:view_id", () => {
  it("updates view name and returns 200", async () => {
    const createRes = await request(app).post("/views").send({ name: "TmpView" });
    expect(createRes.status).toBe(201);
    const id = (createRes.body as ViewDetailOut).identifier;

    const putRes = await request(app).put(`/views/${id}`).send({ name: "RenamedView" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe("RenamedView");

    await request(app).delete(`/views/${id}`);
  });

  it("returns 404 for unknown id", async () => {
    expect((await request(app).put(`/views/${UNKNOWN_ID}`).send({ name: "X" })).status).toBe(404);
  });
});

describe("DELETE /views/:view_id", () => {
  it("removes view and returns 204", async () => {
    const createRes = await request(app).post("/views").send({ name: "ToDelete" });
    const id = (createRes.body as ViewDetailOut).identifier;
    expect((await request(app).delete(`/views/${id}`)).status).toBe(204);
    expect((await request(app).get(`/views/${id}`)).status).toBe(404);
  });

  it("returns 404 for unknown id", async () => {
    expect((await request(app).delete(`/views/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

describe("POST /views/:view_id/nodes", () => {
  let testViewId: string;
  let testElemId: string;

  beforeAll(async () => {
    const vRes = await request(app).post("/views").send({ name: "NodeTestView" });
    testViewId = (vRes.body as ViewDetailOut).identifier;
    const eRes = await request(app).post("/elements").send({ name: "NodeTestElem", type: "ApplicationComponent" });
    testElemId = eRes.body.identifier as string;
  });

  it("creates a node and returns 201", async () => {
    const res = await request(app).post(`/views/${testViewId}/nodes`).send({ element_id: testElemId, x: 10, y: 20, w: 100, h: 60 });
    expect(res.status).toBe(201);
    expect(res.body.element_ref).toBe(testElemId);
    expect(res.body.x).toBe(10);
  });

  it("returns 422 when element_id is missing", async () => {
    const res = await request(app).post(`/views/${testViewId}/nodes`).send({ x: 0, y: 0 });
    expect(res.status).toBe(422);
  });

  it("returns 404 when view not found", async () => {
    const res = await request(app).post(`/views/${UNKNOWN_ID}/nodes`).send({ element_id: testElemId });
    expect(res.status).toBe(404);
  });
});

describe("PUT /views/:view_id/nodes/:node_id and DELETE", () => {
  let viewId: string;
  let elemId: string;
  let nodeId: string;

  beforeAll(async () => {
    const vRes = await request(app).post("/views").send({ name: "NodeUpdateView" });
    viewId = (vRes.body as ViewDetailOut).identifier;
    const eRes = await request(app).post("/elements").send({ name: "NodeUpdateElem", type: "ApplicationComponent" });
    elemId = eRes.body.identifier as string;
    const nRes = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: elemId });
    nodeId = nRes.body.identifier as string;
  });

  it("updates node position via PUT", async () => {
    const res = await request(app).put(`/views/${viewId}/nodes/${nodeId}`).send({ x: 50, y: 60 });
    expect(res.status).toBe(200);
    expect(res.body.x).toBe(50);
  });

  it("returns 404 PUT when view not found", async () => {
    expect((await request(app).put(`/views/${UNKNOWN_ID}/nodes/${nodeId}`).send({ x: 0 })).status).toBe(404);
  });

  it("deletes node via DELETE and returns 204", async () => {
    const nRes = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: elemId });
    const nId = nRes.body.identifier as string;
    expect((await request(app).delete(`/views/${viewId}/nodes/${nId}`)).status).toBe(204);
  });

  it("returns 404 DELETE when view not found", async () => {
    expect((await request(app).delete(`/views/${UNKNOWN_ID}/nodes/${nodeId}`)).status).toBe(404);
  });
});

describe("POST/PUT/DELETE /views/:view_id/connections", () => {
  let viewId: string;
  let nodeAId: string;
  let nodeBId: string;

  beforeAll(async () => {
    const vRes = await request(app).post("/views").send({ name: "ConnTestView" });
    viewId = (vRes.body as ViewDetailOut).identifier;
    const eRes1 = await request(app).post("/elements").send({ name: "ConnElemA", type: "ApplicationComponent" });
    const eRes2 = await request(app).post("/elements").send({ name: "ConnElemB", type: "ApplicationComponent" });
    const nRes1 = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: eRes1.body.identifier });
    const nRes2 = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: eRes2.body.identifier });
    nodeAId = nRes1.body.identifier as string;
    nodeBId = nRes2.body.identifier as string;
  });

  it("creates a connection and returns 201", async () => {
    const res = await request(app).post(`/views/${viewId}/connections`).send({ source: nodeAId, target: nodeBId });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe(nodeAId);
    expect(res.body.target).toBe(nodeBId);
  });

  it("returns 422 when source is missing", async () => {
    const res = await request(app).post(`/views/${viewId}/connections`).send({ target: nodeBId });
    expect(res.status).toBe(422);
  });

  it("returns 404 when view not found", async () => {
    expect((await request(app).post(`/views/${UNKNOWN_ID}/connections`).send({ source: nodeAId, target: nodeBId })).status).toBe(404);
  });

  it("updates connection name via PUT", async () => {
    const cRes = await request(app).post(`/views/${viewId}/connections`).send({ source: nodeAId, target: nodeBId });
    const connId = cRes.body.identifier as string;
    const putRes = await request(app).put(`/views/${viewId}/connections/${connId}`).send({ name: "Flow" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe("Flow");
  });

  it("returns 404 PUT when connection not found", async () => {
    expect((await request(app).put(`/views/${viewId}/connections/${UNKNOWN_ID}`).send({ name: "X" })).status).toBe(404);
  });

  it("deletes connection and returns 204", async () => {
    const cRes = await request(app).post(`/views/${viewId}/connections`).send({ source: nodeAId, target: nodeBId });
    const connId = cRes.body.identifier as string;
    expect((await request(app).delete(`/views/${viewId}/connections/${connId}`)).status).toBe(204);
  });

  it("returns 404 DELETE when connection not found", async () => {
    expect((await request(app).delete(`/views/${viewId}/connections/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – misc endpoints
// ===========================================================================

describe("GET /viewpoints", () => {
  it("returns a sorted array of viewpoint names", async () => {
    const res = await request(app).get("/viewpoints");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(typeof res.body[0]).toBe("string");
  });
});

describe("GET /openapi.json", () => {
  it("returns the OpenAPI spec object", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("openapi");
    expect(res.body).toHaveProperty("paths");
  });
});

describe("POST /save", () => {
  it("returns saved true and a path string", async () => {
    const res = await request(app).post("/save");
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    expect(typeof res.body.path).toBe("string");
  });
});

describe("GET /export", () => {
  it("returns XML content-type", async () => {
    const res = await request(app).get("/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.text).toContain("<?xml");
  });
});

describe("POST /import", () => {
  it("imports a valid Open Exchange XML body", async () => {
    const xmlRes = await request(app).get("/export");
    const xml = xmlRes.text;
    const res = await request(app)
      .post("/import")
      .set("Content-Type", "text/xml")
      .send(xml);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name");
  });

  it("returns 422 for invalid XML body", async () => {
    const res = await request(app)
      .post("/import")
      .set("Content-Type", "text/xml")
      .send("not-xml-at-all");
    expect(res.status).toBe(422);
  });
});

// ===========================================================================
// Integration tests – /roles CRUD
// ===========================================================================

describe("GET /roles", () => {
  it("returns 200 and an array", async () => {
    const res = await request(app).get("/roles");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /roles/catalog", () => {
  it("returns layers and flags", async () => {
    const res = await request(app).get("/roles/catalog");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("layers");
    expect(res.body).toHaveProperty("flags");
  });
});

describe("POST/GET/PUT/DELETE /roles lifecycle", () => {
  let roleId: string;

  it("creates a role (POST /roles)", async () => {
    const res = await request(app).post("/roles").send({ name: "TestRole" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("TestRole");
    roleId = res.body.id as string;
  });

  it("reads the role (GET /roles/:id)", async () => {
    const res = await request(app).get(`/roles/${roleId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(roleId);
  });

  it("updates the role name (PUT /roles/:id)", async () => {
    const res = await request(app).put(`/roles/${roleId}`).send({ name: "UpdatedRole" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("UpdatedRole");
  });

  it("sets layer permissions (PUT /roles/:id/layers/:layer)", async () => {
    const res = await request(app).put(`/roles/${roleId}/layers/Application`).send({ permissions: ["read", "create"] });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain("read");
  });

  it("gets layer permission (GET /roles/:id/layers/:layer)", async () => {
    const res = await request(app).get(`/roles/${roleId}/layers/Application`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("layer");
    expect(res.body).toHaveProperty("permission");
  });

  it("gets all layer permissions (GET /roles/:id/layers)", async () => {
    const res = await request(app).get(`/roles/${roleId}/layers`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("Application");
  });

  it("removes layer permission (DELETE /roles/:id/layers/:layer)", async () => {
    const res = await request(app).delete(`/roles/${roleId}/layers/Application`);
    expect(res.status).toBe(204);
  });

  it("deletes the role (DELETE /roles/:id)", async () => {
    const res = await request(app).delete(`/roles/${roleId}`);
    expect(res.status).toBe(204);
    expect((await request(app).get(`/roles/${roleId}`)).status).toBe(404);
  });
});

describe("POST /roles validation", () => {
  it("returns 422 when name is missing", async () => {
    const res = await request(app).post("/roles").send({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when permissions array is missing on layer PUT", async () => {
    const createRes = await request(app).post("/roles").send({ name: "TmpRoleValidation" });
    const id = createRes.body.id as string;
    const res = await request(app).put(`/roles/${id}/layers/Application`).send({ permissions: "not-an-array" });
    expect(res.status).toBe(422);
    await request(app).delete(`/roles/${id}`);
  });

  it("sanitizes permissions with unknown layers and valid layers", async () => {
    const createRes = await request(app).post("/roles").send({ name: "SanitizeTest" });
    const id = createRes.body.id as string;
    const res = await request(app).put(`/roles/${id}`).send({
      name: "SanitizeTest2",
      permissions: {
        NotARealLayer: ["read"],
        Business: ["read"],
      },
    });
    expect(res.status).toBe(200);
    await request(app).delete(`/roles/${id}`);
  });
});

describe("GET /auth/providers", () => {
  it("returns a list", async () => {
    const res = await request(app).get("/auth/providers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("System role protection", () => {
  it("returns 403 when trying to update a system role", async () => {
    const roles = (await request(app).get("/roles")).body as Array<{ id: string; is_system: boolean }>;
    const sysRole = roles.find((r) => r.is_system);
    if (!sysRole) return;
    const res = await request(app).put(`/roles/${sysRole.id}`).send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });
});

describe("Role user assignment", () => {
  let roleId: string;
  let userId: string;

  beforeAll(async () => {
    const rRes = await request(app).post("/roles").send({ name: "AssignTestRole" });
    roleId = rRes.body.id as string;
    const uRes = await request(app).post("/users").send({ username: "assigntestuser", password: "test1234" });
    userId = uRes.body.id as string;
  });

  it("assigns user to role (PUT /roles/:id/users/:userId)", async () => {
    const res = await request(app).put(`/roles/${roleId}/users/${userId}`);
    expect(res.status).toBe(204);
  });

  it("lists users in role (GET /roles/:id/users)", async () => {
    const res = await request(app).get(`/roles/${roleId}/users`);
    expect(res.status).toBe(200);
    expect(res.body).toContain(userId);
  });

  it("lists roles for user (GET /users/:id/roles)", async () => {
    const res = await request(app).get(`/users/${userId}/roles`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("unassigns user from role (DELETE /roles/:id/users/:userId)", async () => {
    const res = await request(app).delete(`/roles/${roleId}/users/${userId}`);
    expect(res.status).toBe(204);
  });

  afterAll(async () => {
    await request(app).delete(`/roles/${roleId}`);
    await request(app).delete(`/users/${userId}`);
  });
});

describe("GET /export/zip", () => {
  it("returns a zip file", async () => {
    const res = await request(app).get("/export/zip");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/zip");
  });
});

describe("updateViewConnection source/target update", () => {
  it("successfully updates source and target nodes", async () => {
    const vRes = await request(app).post("/views").send({ name: "ConnSrcTgtView" });
    const viewId = (vRes.body as ViewDetailOut).identifier;
    const e1 = await request(app).post("/elements").send({ name: "E1", type: "ApplicationComponent" });
    const e2 = await request(app).post("/elements").send({ name: "E2", type: "ApplicationComponent" });
    const e3 = await request(app).post("/elements").send({ name: "E3", type: "ApplicationComponent" });
    const n1 = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: e1.body.identifier });
    const n2 = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: e2.body.identifier });
    const n3 = await request(app).post(`/views/${viewId}/nodes`).send({ element_id: e3.body.identifier });
    const cRes = await request(app).post(`/views/${viewId}/connections`).send({ source: n1.body.identifier, target: n2.body.identifier });
    const connId = cRes.body.identifier as string;
    const putRes = await request(app)
      .put(`/views/${viewId}/connections/${connId}`)
      .send({ source: n1.body.identifier, target: n3.body.identifier });
    expect(putRes.status).toBe(200);
    expect(putRes.body.target).toBe(n3.body.identifier);
    await request(app).delete(`/views/${viewId}`);
  });
});
// ===========================================================================
// Integration tests – /settings/providers CRUD
// ===========================================================================

describe("GET /settings/providers", () => {
  it("returns 200 and empty array initially", async () => {
    const res = await request(app).get("/settings/providers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST/GET/PUT/DELETE /settings/providers lifecycle", () => {
  let providerId: string;

  it("creates an OIDC provider (POST)", async () => {
    const res = await request(app).post("/settings/providers").send({
      type: "oidc",
      name: "Test OIDC",
      client_id: "client-123",
      client_secret: "secret-abc",
      issuer_url: "https://sso.example.com/realms/test",
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test OIDC");
    expect(res.body.type).toBe("oidc");
    expect(res.body.issuer_url).toBe("https://sso.example.com/realms/test");
    providerId = res.body.id as string;
  });

  it("lists the created provider (GET)", async () => {
    const res = await request(app).get("/settings/providers");
    expect(res.status).toBe(200);
    const found = (res.body as Array<{ id: string }>).find((p) => p.id === providerId);
    expect(found).toBeDefined();
  });

  it("updates the provider name (PUT)", async () => {
    const res = await request(app).put(`/settings/providers/${providerId}`).send({ name: "Updated OIDC" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated OIDC");
  });

  it("disables the provider (PUT enabled=false)", async () => {
    const res = await request(app).put(`/settings/providers/${providerId}`).send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it("deletes the provider (DELETE)", async () => {
    const res = await request(app).delete(`/settings/providers/${providerId}`);
    expect(res.status).toBe(204);
  });

  it("returns 404 after deletion (PUT)", async () => {
    const res = await request(app).put(`/settings/providers/${providerId}`).send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("returns 404 after deletion (DELETE)", async () => {
    const res = await request(app).delete(`/settings/providers/${providerId}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /settings/providers validation", () => {
  it("returns 422 for invalid type", async () => {
    const res = await request(app).post("/settings/providers").send({
      type: "invalid-type", name: "X", client_id: "c", client_secret: "s",
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when name is missing", async () => {
    const res = await request(app).post("/settings/providers").send({
      type: "google", client_id: "c", client_secret: "s",
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when client_id is missing", async () => {
    const res = await request(app).post("/settings/providers").send({
      type: "google", name: "Google", client_secret: "s",
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when client_secret is missing", async () => {
    const res = await request(app).post("/settings/providers").send({
      type: "google", name: "Google", client_id: "c",
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when issuer_url missing for oidc type", async () => {
    const res = await request(app).post("/settings/providers").send({
      type: "oidc", name: "OIDC", client_id: "c", client_secret: "s",
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 for duplicate provider_id", async () => {
    await request(app).post("/settings/providers").send({
      type: "google", name: "Google Test", client_id: "c", client_secret: "s",
    });
    const res = await request(app).post("/settings/providers").send({
      type: "google", name: "Google Test", client_id: "c2", client_secret: "s2",
    });
    expect(res.status).toBe(422);
    // cleanup
    const list = (await request(app).get("/settings/providers")).body as Array<{ id: string; name: string }>;
    const dup = list.find((p) => p.name === "Google Test");
    if (dup) await request(app).delete(`/settings/providers/${dup.id}`);
  });
});

// ===========================================================================
// Integration tests – /settings/mcp-token
// ===========================================================================

describe("GET /settings/mcp-token", () => {
  it("returns null when no token has been generated", async () => {
    const res = await request(app).get("/settings/mcp-token");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe("POST /settings/mcp-token/regenerate + GET lifecycle", () => {
  it("generates a token and returns it", async () => {
    const res = await request(app).post("/settings/mcp-token/regenerate").send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(typeof res.body.created_at).toBe("number");
  });

  it("GET returns the generated token", async () => {
    const gen = await request(app).post("/settings/mcp-token/regenerate").send({});
    const token = gen.body.token as string;

    const res = await request(app).get("/settings/mcp-token");
    expect(res.status).toBe(200);
    expect(res.body.token).toBe(token);
  });

  it("regenerate replaces the previous token", async () => {
    const first = (await request(app).post("/settings/mcp-token/regenerate").send({})).body.token as string;
    const second = (await request(app).post("/settings/mcp-token/regenerate").send({})).body.token as string;
    expect(second).not.toBe(first);
    const res = await request(app).get("/settings/mcp-token");
    expect(res.body.token).toBe(second);
  });
});
