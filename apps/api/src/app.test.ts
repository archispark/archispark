/**
 * Tests for the ArchiMate API (src/app.ts).
 *
 * Structure:
 * - Unit tests: internal helpers tested with plain objects (no real model).
 * - Integration tests: supertest against the Express app with the real model.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import { serializeToOpenExchange } from "../src/oxf-serializer.js";
import { renderViewToSvg } from "../src/renderer.js";
import { parseOpenExchange } from "../src/oxf-parser.js";

import {
  app,
  hexToRgb,
  elementOut,
  relOut,
  nodeOut,
  connectionOut,
  viewOut,
  createElement,
  updateElement,
  deleteElement,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  createView,
  createNode,
  saveModel,
} from "../src/app.js";
import { dataSource } from "../src/registry.js";
import type { DataSource } from "../src/registry.js";
import type { ArchiModel } from "../src/model.js";
import {
  ACCESS_TYPES,
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  VIEWPOINTS,
  type ElementOut,
  type RelationshipOut,
  type ViewOut,
  type ViewDetailOut,
} from "../src/schemas.js";
import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView } from "../src/model.js";

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

let ds: DataSource;
let elementsData: ElementOut[];
let knownElement: ElementOut;
let knownElementType: string;
let knownElementNameFragment: string;
let relationshipsData: RelationshipOut[];
let knownRelationship: RelationshipOut;
let knownRelationshipType: string;
let knownView: ViewOut;
let sharedMcpSessionId = "";

beforeAll(async () => {
  ds = dataSource;

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
// Unit tests – schema constants
// ===========================================================================

describe("Schema constants", () => {
  it("ELEMENT_TYPES has 62 types", () => {
    expect(ELEMENT_TYPES.size).toBe(62);
  });

  it("ELEMENT_TYPES contains Business Layer types", () => {
    const expected = [
      "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
      "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
      "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Application Layer types", () => {
    const expected = [
      "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
      "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
      "ApplicationEvent", "ApplicationService", "DataObject",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Technology Layer types", () => {
    const expected = [
      "Node", "Device", "SystemSoftware", "TechnologyCollaboration",
      "TechnologyInterface", "Path", "CommunicationNetwork", "TechnologyFunction",
      "TechnologyProcess", "TechnologyInteraction", "TechnologyEvent",
      "TechnologyService", "Artifact",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Motivation types", () => {
    const expected = [
      "Stakeholder", "Driver", "Assessment", "Goal", "Outcome",
      "Principle", "Requirement", "Constraint", "Meaning", "Value",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Strategy types", () => {
    for (const t of ["Resource", "Capability", "CourseOfAction", "ValueStream"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("ELEMENT_TYPES contains Implementation & Migration types", () => {
    for (const t of ["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("ELEMENT_TYPES contains Composites & Junctions", () => {
    for (const t of ["Grouping", "Location", "AndJunction", "OrJunction"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("RELATIONSHIP_TYPES has all 11 types", () => {
    const expected = new Set([
      "Composition", "Aggregation", "Assignment", "Realization", "Serving",
      "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
    ]);
    expect(RELATIONSHIP_TYPES).toEqual(expected);
  });

  it("ACCESS_TYPES are correct", () => {
    expect(ACCESS_TYPES).toEqual(new Set(["Access", "Read", "Write", "ReadWrite"]));
  });

  it("VIEWPOINTS has at least 20 entries", () => {
    expect(VIEWPOINTS.size).toBeGreaterThanOrEqual(20);
  });

  it("VIEWPOINTS contains standard viewpoints", () => {
    expect(VIEWPOINTS.has("Layered")).toBe(true);
    expect(VIEWPOINTS.has("Motivation")).toBe(true);
    expect(VIEWPOINTS.has("Strategy")).toBe(true);
  });
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
    expect(data.length).toBe(ds.model.elements.length);
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
    expect(data.length).toBe(ds.model.relationships.length);
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
    expect(data.length).toBe(ds.model.views.length);
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
      const idx = dataSource.model.views.findIndex((v) => v.uuid === id);
      if (idx !== -1) dataSource.model.views.splice(idx, 1);
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
    const view = dataSource.model.views.find((v) => v.uuid === testViewId);
    if (view) view.nodes = [];
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
// Unit tests – mutation helpers (makeDataSource factory)
// ===========================================================================

function makeDataSource(overrides: Partial<ArchiModel> = {}): DataSource {
  const model: ArchiModel = {
    uuid: "model-001",
    name: "Test Model",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    views: [],
    ...overrides,
  };
  return { path: "data/test.xml", model, elementTypes: [], relationshipTypes: [] };
}

describe("createElement", () => {
  it("adds element to model and returns ElementOut", () => {
    const ds = makeDataSource();
    const result = createElement(ds, { name: "My App", type: "ApplicationComponent" });
    expect(ds.model.elements).toHaveLength(1);
    expect(result.name).toBe("My App");
    expect(result.type).toBe("ApplicationComponent");
    expect(result.identifier).toBeTruthy();
  });

  it("updates elementTypes after creation", () => {
    const ds = makeDataSource();
    createElement(ds, { name: "App", type: "ApplicationComponent" });
    expect(ds.elementTypes).toContain("ApplicationComponent");
  });

  it("sets documentation and properties", () => {
    const ds = makeDataSource();
    const result = createElement(ds, {
      name: "Goal1",
      type: "Goal",
      documentation: "A test goal",
      properties: [{ property_definition_ref: "status", value: "active" }],
    });
    expect(result.documentation).toBe("A test goal");
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]!.property_definition_ref).toBe("status");
  });

  it("documentation defaults to null when omitted", () => {
    const ds = makeDataSource();
    const result = createElement(ds, { name: "Test", type: "Goal" });
    expect(result.documentation).toBeNull();
  });
});

describe("updateElement", () => {
  it("updates name", () => {
    const ds = makeDataSource({ elements: [makeElement()] });
    const result = updateElement(ds, "elem-001", { name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("updates type and recomputes elementTypes", () => {
    const ds = makeDataSource({ elements: [makeElement()] });
    ds.elementTypes = ["ApplicationComponent"];
    updateElement(ds, "elem-001", { type: "BusinessActor" });
    expect(ds.elementTypes).toContain("BusinessActor");
    expect(ds.elementTypes).not.toContain("ApplicationComponent");
  });

  it("updates documentation", () => {
    const ds = makeDataSource({ elements: [makeElement({ desc: "old" })] });
    updateElement(ds, "elem-001", { documentation: "new doc" });
    expect(ds.model.elements[0]!.desc).toBe("new doc");
  });

  it("clears documentation when null passed", () => {
    const ds = makeDataSource({ elements: [makeElement({ desc: "something" })] });
    updateElement(ds, "elem-001", { documentation: null });
    expect(ds.model.elements[0]!.desc).toBeNull();
  });

  it("does not touch documentation when key absent", () => {
    const ds = makeDataSource({ elements: [makeElement({ desc: "kept" })] });
    updateElement(ds, "elem-001", { name: "New Name" });
    expect(ds.model.elements[0]!.desc).toBe("kept");
  });

  it("updates properties", () => {
    const ds = makeDataSource({ elements: [makeElement()] });
    const result = updateElement(ds, "elem-001", {
      properties: [{ property_definition_ref: "key", value: "val" }],
    });
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]!.value).toBe("val");
  });

  it("throws for unknown id", () => {
    const ds = makeDataSource();
    expect(() => updateElement(ds, "unknown", {})).toThrow("introuvable");
  });
});

describe("deleteElement", () => {
  it("removes element from model", () => {
    const ds = makeDataSource({ elements: [makeElement()] });
    deleteElement(ds, "elem-001");
    expect(ds.model.elements).toHaveLength(0);
  });

  it("updates elementTypes after deletion", () => {
    const ds = makeDataSource({ elements: [makeElement()] });
    ds.elementTypes = ["ApplicationComponent"];
    deleteElement(ds, "elem-001");
    expect(ds.elementTypes).toHaveLength(0);
  });

  it("throws for unknown id", () => {
    const ds = makeDataSource();
    expect(() => deleteElement(ds, "unknown")).toThrow("introuvable");
  });

  it("cascades: removes relationships that reference the deleted element", () => {
    const elem = makeElement({ uuid: "e1" });
    const other = makeElement({ uuid: "e2", name: "Other", type: "BusinessActor" });
    const rel = makeRelationship({ uuid: "r1", source: elem, target: other });
    const ds = makeDataSource({ elements: [elem, other], relationships: [rel] });
    deleteElement(ds, "e1");
    expect(ds.model.relationships).toHaveLength(0);
  });

  it("cascades when element is the target", () => {
    const e1 = makeElement({ uuid: "e1" });
    const e2 = makeElement({ uuid: "e2" });
    const rel = makeRelationship({ uuid: "r1", source: e1, target: e2 });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [rel] });
    deleteElement(ds, "e2");
    expect(ds.model.relationships).toHaveLength(0);
  });

  it("does not remove unrelated relationships", () => {
    const e1 = makeElement({ uuid: "e1" });
    const e2 = makeElement({ uuid: "e2" });
    const e3 = makeElement({ uuid: "e3" });
    const rel = makeRelationship({ uuid: "r1", source: e2, target: e3 });
    const ds = makeDataSource({ elements: [e1, e2, e3], relationships: [rel] });
    deleteElement(ds, "e1");
    expect(ds.model.relationships).toHaveLength(1);
  });
});

describe("createRelationship", () => {
  it("adds relationship to model and returns RelationshipOut", () => {
    const e1 = makeElement({ uuid: "e1" });
    const e2 = makeElement({ uuid: "e2" });
    const ds = makeDataSource({ elements: [e1, e2] });
    const result = createRelationship(ds, { type: "Association", source: "e1", target: "e2" });
    expect(ds.model.relationships).toHaveLength(1);
    expect(result.type).toBe("Association");
    expect(result.source).toBe("e1");
    expect(result.target).toBe("e2");
    expect(result.identifier).toBeTruthy();
  });

  it("sets name and documentation", () => {
    const e1 = makeElement({ uuid: "e1" });
    const e2 = makeElement({ uuid: "e2" });
    const ds = makeDataSource({ elements: [e1, e2] });
    const result = createRelationship(ds, { type: "Flow", source: "e1", target: "e2", name: "My Flow", documentation: "doc" });
    expect(result.name).toBe("My Flow");
    expect(result.documentation).toBe("doc");
  });

  it("sets access_type for Access relationship", () => {
    const e1 = makeElement({ uuid: "e1" });
    const e2 = makeElement({ uuid: "e2" });
    const ds = makeDataSource({ elements: [e1, e2] });
    const result = createRelationship(ds, { type: "Access", source: "e1", target: "e2", access_type: "Write" });
    expect(result.access_type).toBe("Write");
  });

  it("throws for unknown source", () => {
    const e2 = makeElement({ uuid: "e2" });
    const ds = makeDataSource({ elements: [e2] });
    expect(() => createRelationship(ds, { type: "Association", source: "unknown", target: "e2" })).toThrow("source");
  });

  it("throws for unknown target", () => {
    const e1 = makeElement({ uuid: "e1" });
    const ds = makeDataSource({ elements: [e1] });
    expect(() => createRelationship(ds, { type: "Association", source: "e1", target: "unknown" })).toThrow("cible");
  });

  it("updates relationshipTypes", () => {
    const e1 = makeElement({ uuid: "e1" });
    const e2 = makeElement({ uuid: "e2" });
    const ds = makeDataSource({ elements: [e1, e2] });
    createRelationship(ds, { type: "Composition", source: "e1", target: "e2" });
    expect(ds.relationshipTypes).toContain("Composition");
  });
});

describe("updateRelationship", () => {
  it("updates name", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship()] });
    const result = updateRelationship(ds, "rel-001", { name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("updates documentation", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship()] });
    updateRelationship(ds, "rel-001", { documentation: "doc updated" });
    expect(ds.model.relationships[0]!.desc).toBe("doc updated");
  });

  it("does not touch fields not provided", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship({ desc: "original" })] });
    updateRelationship(ds, "rel-001", { name: "X" });
    expect(ds.model.relationships[0]!.desc).toBe("original");
  });

  it("throws for unknown relationship id", () => {
    const ds = makeDataSource();
    expect(() => updateRelationship(ds, "unknown", {})).toThrow("introuvable");
  });

  it("throws when new source element does not exist", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship()] });
    expect(() => updateRelationship(ds, "rel-001", { source: "no-such-id" })).toThrow("source");
  });
});

describe("deleteRelationship", () => {
  it("removes relationship from model", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship()] });
    deleteRelationship(ds, "rel-001");
    expect(ds.model.relationships).toHaveLength(0);
  });

  it("throws for unknown id", () => {
    const ds = makeDataSource();
    expect(() => deleteRelationship(ds, "unknown")).toThrow("introuvable");
  });

  it("updates relationshipTypes after deletion", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship({ type: "Flow" })] });
    ds.relationshipTypes = ["Flow"];
    deleteRelationship(ds, "rel-001");
    expect(ds.relationshipTypes).toHaveLength(0);
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
// Integration tests – MCP service
// ===========================================================================

describe("MCP service", () => {
  const mcpHeaders = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };

  beforeAll(async () => {
    const initRes = await request(app)
      .post("/mcp/")
      .set(mcpHeaders)
      .send({
        jsonrpc: "2.0",
        id: "init-1",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0" },
        },
      });
    sharedMcpSessionId = initRes.headers["mcp-session-id"] as string;
  }, 15000);

  it("POST /mcp/ without session returns 400 for non-initialize request", async () => {
    const res = await request(app)
      .post("/mcp/")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: "1", method: "tools/list", params: {} });
    expect(res.status).toBe(400);
  });

  it("initialize and list tools via JSON-RPC", async () => {
    expect(sharedMcpSessionId).toBeTruthy();


    const toolsRes = await request(app)
      .post("/mcp/")
      .set({ ...mcpHeaders, "mcp-session-id": sharedMcpSessionId })
      .send({ jsonrpc: "2.0", id: "tools-1", method: "tools/list", params: {} });

    expect(toolsRes.status).toBe(200);
    const toolsLine = toolsRes.text.split("\n").find((l) => l.startsWith("data: "));
    const toolsPayload = JSON.parse(toolsLine!.replace("data: ", ""));
    const registeredTools = new Set((toolsPayload.result.tools as { name: string }[]).map((t) => t.name));

    const expectedTools = new Set([
      "get_model_info", "list_element_types", "list_elements", "get_element",
      "list_relationship_types", "list_relationships", "get_relationship",
      "list_views", "get_view", "create_view", "create_node",
      "create_element", "update_element", "delete_element",
      "create_relationship", "update_relationship", "delete_relationship",
      "save_model",
    ]);

    for (const tool of expectedTools) {
      expect(registeredTools.has(tool), `Tool '${tool}' not registered`).toBe(true);
    }
  });
});

// ===========================================================================
// Unit tests – serializeToOpenExchange
// ===========================================================================

describe("serializeToOpenExchange", () => {
  it("produces XML with <model> root and OEF namespace", () => {
    const xml = serializeToOpenExchange(makeDataSource().model);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<model ");
    expect(xml).toContain('xmlns="http://www.opengroup.org/xsd/archimate/3.0/"');
    expect(xml).toContain("</model>");
  });

  it("embeds model name and identifier", () => {
    const xml = serializeToOpenExchange(makeDataSource({ uuid: "a-uuid", name: "OEF Model" }).model);
    expect(xml).toContain('identifier="a-uuid"');
    expect(xml).toContain(">OEF Model<");
  });

  it("uses bare element type name in xsi:type", () => {
    const elem = makeElement({ uuid: "app-1", name: "My App", type: "ApplicationComponent" });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [elem] }).model);
    expect(xml).toContain('xsi:type="ApplicationComponent"');
    expect(xml).toContain('identifier="app-1"');
    expect(xml).toContain(">My App<");
  });

  it("relationship has bare type name (no Relationship suffix) and source/target", () => {
    const src = makeElement({ uuid: "s2" });
    const tgt = makeElement({ uuid: "t2" });
    const rel = makeRelationship({ uuid: "r2", source: src, target: tgt, type: "Association" });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [src, tgt], relationships: [rel] }).model);
    expect(xml).toContain('xsi:type="Association"');
    expect(xml).toContain('source="s2"');
    expect(xml).toContain('target="t2"');
  });

  it("emits Access accessType, Association isDirected, Influence modifier", () => {
    const src = makeElement({ uuid: "rs1" });
    const tgt = makeElement({ uuid: "rt1" });
    const acc = makeRelationship({ uuid: "r-acc", source: src, target: tgt, type: "Access", access_type: "Read" });
    const ass = makeRelationship({ uuid: "r-ass", source: src, target: tgt, type: "Association", is_directed: true });
    const inf = makeRelationship({ uuid: "r-inf", source: src, target: tgt, type: "Influence", influence_strength: "+" });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [src, tgt], relationships: [acc, ass, inf] }).model);
    expect(xml).toContain('accessType="Read"');
    expect(xml).toContain('isDirected="true"');
    expect(xml).toContain('modifier="+"');
  });

  it("renders element documentation and properties", () => {
    const elem = makeElement({
      uuid: "e-docs", name: "Documented", type: "BusinessActor",
      desc: "Important actor", props: { "propid-1": "team-a", "propid-2": "high" },
    });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [elem] }).model);
    expect(xml).toContain("<documentation");
    expect(xml).toContain("Important actor");
    expect(xml).toContain('propertyDefinitionRef="propid-1"');
    expect(xml).toContain(">team-a<");
  });

  it("renders view with nodes, connections, viewpoint, documentation", () => {
    const elem = makeElement({ uuid: "ve1", type: "ApplicationComponent" });
    const node = makeNode({
      uuid: "vn1", name: null, ref: elem.uuid,
      x: 10, y: 20, w: 120, h: 55,
      fill_color: { r: 255, g: 128, b: 0 },
      line_color: { r: 0, g: 0, b: 128 },
    });
    const conn = makeConnection({ uuid: "vc1", source: "vn1", target: "vn2", ref: "rel-x", name: "arrow" });
    const view = makeView({
      uuid: "vv1", name: "App View", desc: "Application architecture",
      primary_viewpoint: "Application Platform",
      nodes: [node], conns: [conn],
    });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [elem], views: [view] }).model);
    expect(xml).toContain('viewpoint="Application Platform"');
    expect(xml).toContain("Application architecture");
    expect(xml).toContain('elementRef="ve1"');
    expect(xml).toContain('relationshipRef="rel-x"');
    expect(xml).toContain('x="10"');
    expect(xml).toContain('<fillColor r="255" g="128" b="0"');
  });

  it("renders connection with bendpoints", () => {
    const conn = makeConnection({ uuid: "c-bp", source: "n1", target: "n2", bendpoints: [{ x: 100, y: 50 }, { x: 200, y: 75 }] });
    const view = makeView({ uuid: "v-bp", nodes: [], conns: [conn] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('<bendpoint x="100" y="50"');
    expect(xml).toContain('<bendpoint x="200" y="75"');
  });

  it("renders empty-view xsi:type=Diagram as self-closing", () => {
    const view = makeView({ uuid: "empty-v", name: "" });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('identifier="empty-v"');
    expect(xml).toContain('xsi:type="Diagram"');
  });

  it("round-trips through parseOpenExchange", () => {
    const src = makeElement({ uuid: "as", name: "Src", type: "BusinessActor" });
    const tgt = makeElement({ uuid: "at", name: "Tgt", type: "BusinessService" });
    const rel = makeRelationship({ uuid: "ar", name: "uses", source: src, target: tgt, type: "Serving" });
    const original = makeDataSource({ uuid: "am", name: "Test OEF", elements: [src, tgt], relationships: [rel] }).model;
    const parsed = parseOpenExchange(serializeToOpenExchange(original));
    expect(parsed.uuid).toBe("am");
    expect(parsed.name).toBe("Test OEF");
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.elements.find((e) => e.uuid === "as")?.type).toBe("BusinessActor");
    expect(parsed.relationships[0]!.type).toBe("Serving");
    expect(parsed.relationships[0]!.name).toBe("uses");
  });
});

// ===========================================================================
// Unit tests – parseOpenExchange: Junction, modifiers, documentation, properties
// ===========================================================================

const OEF_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m1" version="3.1">
  <name xml:lang="fr">FixtureModel</name>
  <documentation xml:lang="fr">model doc</documentation>
  <elements>
    <element identifier="and-id" xsi:type="AndJunction"><name xml:lang="fr">AndJ</name></element>
    <element identifier="or-id" xsi:type="OrJunction"><name xml:lang="fr">OrJ</name></element>
    <element identifier="actor-id" xsi:type="BusinessActor">
      <name xml:lang="fr">Actor</name>
      <documentation xml:lang="fr">actor doc</documentation>
      <properties>
        <property propertyDefinitionRef="propid-1"><value xml:lang="fr">val-1</value></property>
      </properties>
    </element>
    <element identifier="svc-id" xsi:type="BusinessService"><name xml:lang="fr">Svc</name></element>
    <element identifier="ignored-id" xsi:type="UnknownFutureConcept"><name xml:lang="fr">Skip</name></element>
  </elements>
  <relationships>
    <relationship identifier="rel-acc" source="actor-id" target="svc-id" xsi:type="Access" accessType="ReadWrite"/>
    <relationship identifier="rel-ass" source="actor-id" target="svc-id" xsi:type="Association" isDirected="true"/>
    <relationship identifier="rel-inf" source="actor-id" target="svc-id" xsi:type="Influence" modifier="++"/>
    <relationship identifier="rel-named" source="actor-id" target="svc-id" xsi:type="Serving">
      <name xml:lang="fr">serves</name>
    </relationship>
    <relationship identifier="rel-skip" source="actor-id" target="svc-id" xsi:type="NotARelType"/>
  </relationships>
  <organizations>
    <item><label xml:lang="fr">Business</label><item identifierRef="actor-id"/></item>
  </organizations>
  <propertyDefinitions>
    <propertyDefinition identifier="propid-1" type="string"><name>P1</name></propertyDefinition>
  </propertyDefinitions>
  <views>
    <diagrams>
      <view identifier="view1" xsi:type="Diagram" viewpoint="Layered">
        <name xml:lang="fr">View1</name>
        <documentation xml:lang="fr">view doc</documentation>
        <node identifier="n-actor" elementRef="actor-id" xsi:type="Element" x="10" y="20" w="120" h="55">
          <style>
            <fillColor r="255" g="0" b="0" a="100"/>
            <lineColor r="0" g="0" b="0"/>
            <font name="Segoe UI" size="9"><color r="10" g="20" b="30"/></font>
          </style>
        </node>
        <node identifier="n-label" xsi:type="Label" x="0" y="0" w="100" h="40">
          <label xml:lang="fr">A label</label>
        </node>
        <connection identifier="c1" relationshipRef="rel-ass" xsi:type="Relationship" source="n-actor" target="n-label">
          <bendpoint x="50" y="30"/>
        </connection>
      </view>
    </diagrams>
  </views>
</model>`;

describe("parseOpenExchange – core mappings", () => {
  it("parses model identifier, name, version, documentation", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.uuid).toBe("m1");
    expect(m.name).toBe("FixtureModel");
    expect(m.version).toBe("3.1");
    expect(m.desc).toBe("model doc");
  });

  it("parses And/Or Junctions as elements", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.elements.find((e) => e.uuid === "and-id")?.type).toBe("AndJunction");
    expect(m.elements.find((e) => e.uuid === "or-id")?.type).toBe("OrJunction");
  });

  it("skips elements with unknown xsi:type", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.elements.find((e) => e.uuid === "ignored-id")).toBeUndefined();
  });

  it("parses documentation and properties on element", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const actor = m.elements.find((e) => e.uuid === "actor-id")!;
    expect(actor.desc).toBe("actor doc");
    expect(actor.props["propid-1"]).toBe("val-1");
  });

  it("parses relationship modifiers (accessType, isDirected, modifier)", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const acc = m.relationships.find((r) => r.uuid === "rel-acc")!;
    const ass = m.relationships.find((r) => r.uuid === "rel-ass")!;
    const inf = m.relationships.find((r) => r.uuid === "rel-inf")!;
    expect(acc.access_type).toBe("ReadWrite");
    expect(ass.is_directed).toBe(true);
    expect(inf.influence_strength).toBe("++");
  });

  it("skips relationships with unknown xsi:type", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.relationships.find((r) => r.uuid === "rel-skip")).toBeUndefined();
  });

  it("parses named relationship", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.relationships.find((r) => r.uuid === "rel-named")?.name).toBe("serves");
  });

  it("parses view nodes with style and connections with bendpoints", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const v = m.views[0]!;
    expect(v.uuid).toBe("view1");
    expect(v.primary_viewpoint).toBe("Layered");
    expect(v.desc).toBe("view doc");
    const actorNode = v.nodes.find((n) => n.uuid === "n-actor")!;
    expect(actorNode.x).toBe(10);
    expect(actorNode.fill_color).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(actorNode.font_name).toBe("Segoe UI");
    const labelNode = v.nodes.find((n) => n.uuid === "n-label")!;
    expect(labelNode.name).toBe("A label");
    const c = v.conns[0]!;
    expect(c.uuid).toBe("c1");
    expect(c.bendpoints?.[0]).toMatchObject({ x: 50, y: 30 });
  });
});

// ===========================================================================
// Unit tests – round-trip with preserved raw sections
// ===========================================================================

describe("serializeToOpenExchange – round-trip preserves organizations / propertyDefinitions", () => {
  it("preserves organizations subtree through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain("<organizations>");
    expect(xml).toContain('identifierRef="actor-id"');
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements).toHaveLength(m.elements.length);
  });

  it("preserves propertyDefinitions subtree through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain('<propertyDefinition identifier="propid-1"');
    expect(xml).toContain("string");
  });

  it("updates existing element in-place across round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const actor = m.elements.find((e) => e.uuid === "actor-id")!;
    actor.name = "RenamedActor";
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain("RenamedActor");
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements.find((e) => e.uuid === "actor-id")?.name).toBe("RenamedActor");
  });

  it("appends new element and relationship after round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.elements.push({ uuid: "new-id", name: "NewApp", type: "ApplicationComponent", desc: null, props: {} });
    m.relationships.push({
      uuid: "new-rel", name: null, type: "Association",
      source: "new-id", target: "actor-id",
      desc: null, props: {}, access_type: null, is_directed: null, influence_strength: null,
    });
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements.find((e) => e.uuid === "new-id")).toBeTruthy();
    expect(reparsed.relationships.find((r) => r.uuid === "new-rel")).toBeTruthy();
  });

  it("appends new view through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.views.push({ uuid: "v-new", name: "NewView", desc: null, primary_viewpoint: null, nodes: [], conns: [] });
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.views.find((v) => v.uuid === "v-new")).toBeTruthy();
  });

  it("removes deleted elements through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.elements = [];
    m.relationships = [];
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements).toHaveLength(0);
    expect(reparsed.relationships).toHaveLength(0);
  });

  it("renders nested container nodes", () => {
    const child = makeNode({ uuid: "child-n", ref: null, name: null, fill_color: null, line_color: null });
    const parent = makeNode({ uuid: "parent-n", ref: null, name: null, fill_color: null, line_color: null, nodes: [child] });
    const view = makeView({ uuid: "view-c", nodes: [parent], conns: [] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('identifier="parent-n"');
    expect(xml).toContain('identifier="child-n"');
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.views[0]!.nodes[0]!.nodes).toHaveLength(1);
  });

  it("serializes view without _raw (flat path, no model fixture)", () => {
    const view = makeView({ uuid: "vfr", name: "FromScratch", primary_viewpoint: "Layered" });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('identifier="vfr"');
    expect(xml).toContain('viewpoint="Layered"');
  });
});

// ===========================================================================
// Unit tests – createView / createNode
// ===========================================================================

describe("createView", () => {
  it("adds a view to the model", () => {
    const ds = makeDataSource();
    const before = ds.model.views.length;
    createView(ds, { name: "My View" });
    expect(ds.model.views.length).toBe(before + 1);
  });

  it("returns ViewDetailOut with correct name", () => {
    const ds = makeDataSource();
    const out = createView(ds, { name: "My View", viewpoint: "Layered", documentation: "doc" });
    expect(out.name).toBe("My View");
    expect(out.viewpoint).toBe("Layered");
    expect(out.nodes).toEqual([]);
    expect(out.connections).toEqual([]);
  });

  it("assigns a unique identifier", () => {
    const ds = makeDataSource();
    const a = createView(ds, { name: "A" });
    const b = createView(ds, { name: "B" });
    expect(a.identifier).not.toBe(b.identifier);
  });
});

describe("createNode", () => {
  it("adds a node to the view", () => {
    const elem = makeElement();
    const ds = makeDataSource({ elements: [elem] });
    const view = createView(ds, { name: "V" });
    createNode(ds, view.identifier, { element_id: elem.uuid });
    expect(ds.model.views[0]!.nodes.length).toBe(1);
  });

  it("returns NodeOut with element_ref and coordinates", () => {
    const elem = makeElement();
    const ds = makeDataSource({ elements: [elem] });
    const view = createView(ds, { name: "V" });
    const node = createNode(ds, view.identifier, { element_id: elem.uuid, x: 10, y: 20, w: 120, h: 55 });
    expect(node.element_ref).toBe(elem.uuid);
    expect(node.x).toBe(10);
    expect(node.y).toBe(20);
    expect(node.w).toBe(120);
    expect(node.h).toBe(55);
  });

  it("throws when view_id is unknown", () => {
    const elem = makeElement();
    const ds = makeDataSource({ elements: [elem] });
    expect(() => createNode(ds, "no-such-view", { element_id: elem.uuid })).toThrow();
  });

  it("throws when element_id is unknown", () => {
    const ds = makeDataSource();
    const view = createView(ds, { name: "V" });
    expect(() => createNode(ds, view.identifier, { element_id: "no-such-elem" })).toThrow();
  });
});

// ===========================================================================
// Unit tests – saveModel
// ===========================================================================

describe("saveModel", () => {
  it("returns { saved: true, path } and writes the file", () => {
    const tmpPath = `data/test-save-unit-${Date.now()}.xml`;
    const ds = { ...makeDataSource({ name: "Save Test" }), path: tmpPath };
    const result = saveModel(ds);
    expect(result.saved).toBe(true);
    expect(result.path).toBe(tmpPath);
    const fullPath = join(process.cwd(), tmpPath);
    expect(existsSync(fullPath)).toBe(true);
    rmSync(fullPath);
  });
});


// ===========================================================================
// Unit tests – updateRelationship source and target
// ===========================================================================

describe("updateRelationship – source and target update", () => {
  it("successfully updates source element", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const e3 = makeElement({ uuid: "new-src-999" });
    const ds = makeDataSource({ elements: [e1, e2, e3], relationships: [makeRelationship()] });
    const result = updateRelationship(ds, "rel-001", { source: "new-src-999" });
    expect(result.source).toBe("new-src-999");
  });

  it("successfully updates target element", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const e3 = makeElement({ uuid: "new-tgt-999" });
    const ds = makeDataSource({ elements: [e1, e2, e3], relationships: [makeRelationship()] });
    const result = updateRelationship(ds, "rel-001", { target: "new-tgt-999" });
    expect(result.target).toBe("new-tgt-999");
  });

  it("throws when new target element does not exist", () => {
    const e1 = makeElement({ uuid: "src-001" });
    const e2 = makeElement({ uuid: "tgt-001" });
    const ds = makeDataSource({ elements: [e1, e2], relationships: [makeRelationship()] });
    expect(() => updateRelationship(ds, "rel-001", { target: "no-such-tgt" })).toThrow("cible");
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
  it("returns HTML swagger UI page", async () => {
    const res = await request(app).get("/docs");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("swagger-ui");
  });
});

// ===========================================================================
// Integration tests – MCP tool calls via JSON-RPC
// ===========================================================================

describe("MCP tool calls via JSON-RPC", () => {
  async function callTool(toolName: string, args: Record<string, unknown> = {}) {
    const res = await request(app)
      .post("/mcp/")
      .set({ Accept: "application/json, text/event-stream", "Content-Type": "application/json", "mcp-session-id": sharedMcpSessionId })
      .send({ jsonrpc: "2.0", id: `t-${Date.now()}`, method: "tools/call", params: { name: toolName, arguments: args } });
    const line = res.text.split("\n").find((l) => l.startsWith("data: "));
    return JSON.parse(line!.replace("data: ", "")) as { result?: { content: { text: string }[]; isError?: boolean }; error?: unknown };
  }

  function parseToolResult(payload: { result?: { content: { text: string }[]; isError?: boolean } }) {
    return JSON.parse(payload.result!.content[0]!.text) as Record<string, unknown>;
  }

  it("get_model_info returns model metadata", async () => {
    const payload = await callTool("get_model_info");
    expect(payload.result).toBeTruthy();
    const data = parseToolResult(payload);
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("element_count");
  });

  it("list_element_types returns sorted types array", async () => {
    const payload = await callTool("list_element_types");
    const types = parseToolResult(payload) as unknown as string[];
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
  });

  it("list_elements with valid element_type filter", async () => {
    const payload = await callTool("list_elements", { element_type: "BusinessActor" });
    const elems = parseToolResult(payload) as unknown as unknown[];
    expect(Array.isArray(elems)).toBe(true);
  });

  it("list_elements with invalid element_type throws MCP error", async () => {
    const payload = await callTool("list_elements", { element_type: "NotAValidType" });
    expect(payload.error || payload.result?.isError).toBeTruthy();
  });

  it("get_element returns element detail", async () => {
    const payload = await callTool("get_element", { element_id: knownElement.identifier });
    const data = parseToolResult(payload);
    expect(data["identifier"]).toBe(knownElement.identifier);
  });

  it("list_relationship_types returns sorted types array", async () => {
    const payload = await callTool("list_relationship_types");
    const types = parseToolResult(payload) as unknown as string[];
    expect(Array.isArray(types)).toBe(true);
  });

  it("list_relationships with valid rel_type filter", async () => {
    const payload = await callTool("list_relationships", { rel_type: "Association" });
    const rels = parseToolResult(payload) as unknown as unknown[];
    expect(Array.isArray(rels)).toBe(true);
  });

  it("list_relationships with invalid rel_type throws MCP error", async () => {
    const payload = await callTool("list_relationships", { rel_type: "NotARelType" });
    expect(payload.error || payload.result?.isError).toBeTruthy();
  });

  it("get_relationship returns relationship detail", async () => {
    const payload = await callTool("get_relationship", { relationship_id: knownRelationship.identifier });
    const data = parseToolResult(payload);
    expect(data["identifier"]).toBe(knownRelationship.identifier);
  });

  it("list_views returns view list", async () => {
    const payload = await callTool("list_views");
    const views = parseToolResult(payload) as unknown as unknown[];
    expect(Array.isArray(views)).toBe(true);
    expect(views.length).toBeGreaterThan(0);
  });

  it("get_view returns view detail", async () => {
    const payload = await callTool("get_view", { view_id: knownView.identifier });
    const data = parseToolResult(payload);
    expect(data["identifier"]).toBe(knownView.identifier);
  });

  it("create_view creates a view with viewpoint and documentation", async () => {
    const payload = await callTool("create_view", { name: "MCP View", viewpoint: "Layered", documentation: "mcp-created" });
    const data = parseToolResult(payload);
    expect(data["identifier"]).toBeTruthy();
    expect(data["name"]).toBe("MCP View");
    expect(data["viewpoint"]).toBe("Layered");
  });

  it("create_element (valid type), update_element (all fields), delete_element", async () => {
    const created = parseToolResult(await callTool("create_element", {
      name: "MCP App",
      type: "ApplicationComponent",
      documentation: "mcp doc",
      properties: [{ property_definition_ref: "k", value: "v" }],
    }));
    const elemId = created["identifier"] as string;
    expect(elemId).toBeTruthy();

    const updated = parseToolResult(await callTool("update_element", {
      element_id: elemId,
      name: "MCP App Updated",
      type: "ApplicationComponent",
      documentation: "updated doc",
      properties: [{ property_definition_ref: "k2", value: "v2" }],
    }));
    expect(updated["name"]).toBe("MCP App Updated");

    const deleted = parseToolResult(await callTool("delete_element", { element_id: elemId }));
    expect(deleted["deleted"]).toBe(true);
  });

  it("create_element with invalid type throws MCP error", async () => {
    const payload = await callTool("create_element", { name: "Bad", type: "NotValid" });
    expect(payload.error || payload.result?.isError).toBeTruthy();
  });

  it("update_element with invalid type throws MCP error", async () => {
    const tmp = parseToolResult(await callTool("create_element", { name: "TmpE", type: "BusinessActor" }));
    const tmpId = tmp["identifier"] as string;
    const payload = await callTool("update_element", { element_id: tmpId, type: "BadType" });
    expect(payload.error || payload.result?.isError).toBeTruthy();
    await callTool("delete_element", { element_id: tmpId });
  });

  it("create_relationship (all fields), update_relationship (all fields), delete_relationship", async () => {
    const e1 = parseToolResult(await callTool("create_element", { name: "MCP-E1", type: "BusinessActor" }));
    const e2 = parseToolResult(await callTool("create_element", { name: "MCP-E2", type: "BusinessService" }));
    const e1Id = e1["identifier"] as string;
    const e2Id = e2["identifier"] as string;

    const rel = parseToolResult(await callTool("create_relationship", {
      type: "Association",
      source: e1Id,
      target: e2Id,
      name: "mcp-rel",
      documentation: "rel doc",
      is_directed: true,
    }));
    const relId = rel["identifier"] as string;
    expect(relId).toBeTruthy();

    const updated = parseToolResult(await callTool("update_relationship", {
      relationship_id: relId,
      name: "updated-mcp-rel",
      type: "Serving",
      source: e1Id,
      target: e2Id,
      documentation: "updated doc",
      properties: [{ property_definition_ref: "rk", value: "rv" }],
      access_type: null,
      is_directed: false,
      influence_strength: null,
    }));
    expect(updated["name"]).toBe("updated-mcp-rel");
    expect(updated["type"]).toBe("Serving");

    const deleted = parseToolResult(await callTool("delete_relationship", { relationship_id: relId }));
    expect(deleted["deleted"]).toBe(true);

    await callTool("delete_element", { element_id: e1Id });
    await callTool("delete_element", { element_id: e2Id });
  });

  it("create_relationship with invalid type throws MCP error", async () => {
    const payload = await callTool("create_relationship", { type: "BadRel", source: "x", target: "y" });
    expect(payload.error || payload.result?.isError).toBeTruthy();
  });

  it("update_relationship with invalid type throws MCP error", async () => {
    const payload = await callTool("update_relationship", { relationship_id: "any", type: "BadRelType" });
    expect(payload.error || payload.result?.isError).toBeTruthy();
  });

  it("create_node adds a node to a view", async () => {
    const view = parseToolResult(await callTool("create_view", { name: "MCP Node Test View" }));
    const viewId = view["identifier"] as string;
    const elem = parseToolResult(await callTool("create_element", { name: "MCP-NodeElem", type: "ApplicationComponent" }));
    const elemId = elem["identifier"] as string;

    const node = parseToolResult(await callTool("create_node", { view_id: viewId, element_id: elemId, x: 10, y: 20, w: 100, h: 50 }));
    expect(node["element_ref"]).toBe(elemId);
    expect(node["x"]).toBe(10);

    await callTool("delete_element", { element_id: elemId });
  });

  it("save_model returns saved: true", async () => {
    const data = parseToolResult(await callTool("save_model"));
    expect(data["saved"]).toBe(true);
  });

  it("GET /mcp/ without session returns 405", async () => {
    const res = await request(app).get("/mcp/");
    expect(res.status).toBe(405);
  });

  it("GET /mcp/ with valid session handles SSE request", async () => {
    const res = await request(app).get("/mcp/").set({ "mcp-session-id": sharedMcpSessionId });
    expect([200, 204, 405, 406]).toContain(res.status);
  });

  it("DELETE /mcp/ without session returns 404", async () => {
    const res = await request(app).delete("/mcp/");
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Unit tests – additional OEF parser / serializer branches
// ===========================================================================

describe("oxf-parser – edge cases", () => {
  it("parses model with no <elements>/<relationships>/<views> sections", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="empty-m">
  <name xml:lang="fr">Empty</name>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.elements).toHaveLength(0);
    expect(m.relationships).toHaveLength(0);
    expect(m.views).toHaveLength(0);
  });

  it("parses viewpointRef as fallback for primary_viewpoint", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m">
  <name xml:lang="fr">M</name>
  <views><diagrams>
    <view identifier="v1" xsi:type="Diagram" viewpointRef="vp-x">
      <name xml:lang="fr">V</name>
    </view>
  </diagrams></views>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.views[0]!.primary_viewpoint).toBe("vp-x");
  });

  it("parses node without elementRef as Label kind (no ref)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m">
  <name xml:lang="fr">M</name>
  <views><diagrams>
    <view identifier="v1" xsi:type="Diagram">
      <name xml:lang="fr">V</name>
      <node identifier="n-x" xsi:type="Label" x="0" y="0" w="10" h="10"/>
    </view>
  </diagrams></views>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.views[0]!.nodes[0]!.ref).toBeNull();
  });
});

describe("serializeToOpenExchange – misc branches", () => {
  it("emits relationship with documentation and properties", () => {
    const src = makeElement({ uuid: "rsp1" });
    const tgt = makeElement({ uuid: "rtp1" });
    const rel = makeRelationship({
      uuid: "r-full", source: src, target: tgt, type: "Flow",
      name: "flows", desc: "rel doc", props: { "propid-1": "v1" },
    });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [src, tgt], relationships: [rel] }).model);
    expect(xml).toContain(">rel doc<");
    expect(xml).toContain('propertyDefinitionRef="propid-1"');
    expect(xml).toContain('xsi:type="Flow"');
  });

  it("emits connection without relationshipRef as xsi:type=Line", () => {
    const conn = makeConnection({ uuid: "c-line", source: "n1", target: "n2", ref: null });
    const view = makeView({ uuid: "v-line", nodes: [], conns: [conn] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('xsi:type="Line"');
  });

  it("emits node with line_width on style", () => {
    const node = makeNode({ uuid: "n-lw", ref: null, name: null, fill_color: null, line_color: null, line_width: 3 });
    const view = makeView({ uuid: "v-lw", nodes: [node], conns: [] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('lineWidth="3"');
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg
// ===========================================================================

describe("renderViewToSvg – empty view", () => {
  const emptyModel: ArchiModel = {
    uuid: "m1", name: "Model", desc: null, version: null,
    elements: [], relationships: [], views: [],
  };

  it("returns a string starting with <svg", () => {
    const svg = renderViewToSvg(makeView(), emptyModel);
    expect(svg.trimStart()).toMatch(/^<svg /);
  });

  it("includes the view name in the output", () => {
    const svg = renderViewToSvg(makeView({ name: "My Test View" }), emptyModel);
    expect(svg).toContain("My Test View");
  });

  it("includes SVG namespace declaration", () => {
    const svg = renderViewToSvg(makeView(), emptyModel);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("closes the svg tag", () => {
    const svg = renderViewToSvg(makeView(), emptyModel);
    expect(svg).toContain("</svg>");
  });

  it("escapes XML special characters in view name", () => {
    const svg = renderViewToSvg(makeView({ name: "View <A> & 'B'" }), emptyModel);
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;");
    expect(svg).not.toContain("<A>");
  });
});

describe("renderViewToSvg – with nodes", () => {
  const elem: ArchiElement = { uuid: "e1", name: "My App", type: "ApplicationComponent", desc: null, props: {} };
  const model: ArchiModel = {
    uuid: "m1", name: "Model", desc: null, version: null,
    elements: [elem], relationships: [], views: [],
  };

  it("includes element name in rendered SVG", () => {
    const node = makeNode({ uuid: "n1", ref: elem, x: 10, y: 10, w: 120, h: 55 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), model);
    expect(svg).toContain("My App");
  });

  it("renders a rect for the node", () => {
    const node = makeNode({ uuid: "n1", ref: elem });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), model);
    expect(svg).toContain("<rect ");
  });

  it("renders a connection line between two nodes", () => {
    const n1 = makeNode({ uuid: "n1", ref: elem, x: 10,  y: 10, w: 120, h: 55 });
    const n2 = makeNode({ uuid: "n2", ref: elem, x: 200, y: 10, w: 120, h: 55 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: null });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), model);
    expect(svg).toContain("<polyline ");
  });

  it("applies dashed stroke for Realization connection type", () => {
    const rel: ArchiRelationship = {
      uuid: "rel-r1", name: null, type: "Realization",
      source: elem, target: elem,
      desc: null, props: {}, access_type: null, is_directed: null, influence_strength: null,
    };
    const relModel = { ...model, relationships: [rel] };
    const n1 = makeNode({ uuid: "n1", ref: elem, x: 10,  y: 10, w: 120, h: 55 });
    const n2 = makeNode({ uuid: "n2", ref: elem, x: 200, y: 10, w: 120, h: 55 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel-r1" });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), relModel);
    expect(svg).toContain('stroke-dasharray="6,3"');
  });

  it("renders junctions as circles (no element rect)", () => {
    const junction: ArchiElement = { uuid: "j1", name: "", type: "AndJunction", desc: null, props: {} };
    const jModel = { ...model, elements: [junction] };
    // null fill_color so ELEMENT_FILL default kicks in
    const node = makeNode({ uuid: "n1", ref: junction, x: 50, y: 50, w: 14, h: 14, fill_color: null, line_color: null });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), jModel);
    expect(svg).toContain("<circle ");
    // junction renders as fill="#000000" from ELEMENT_FILL["AndJunction"]
    expect(svg).toContain('fill="#000000"');
  });

  it("renders Grouping with dashed border", () => {
    const grouping: ArchiElement = { uuid: "g1", name: "My Group", type: "Grouping", desc: null, props: {} };
    const gModel = { ...model, elements: [grouping] };
    const node = makeNode({ uuid: "n1", ref: grouping, x: 0, y: 0, w: 300, h: 200 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), gModel);
    expect(svg).toContain('stroke-dasharray="6,4"');
  });
});

describe("renderViewToSvg – specialized shapes (archi_type=1)", () => {
  const baseModel = (type: string, uuid = "e1"): ArchiModel => ({
    uuid: "m1", name: "Model", desc: null, version: null,
    elements: [{ uuid, name: type, type, desc: null, props: {} }],
    relationships: [], views: [],
  });

  function makeIconNode(type: string, uuid = "e1") {
    const m = baseModel(type, uuid);
    const node = makeNode({
      uuid: "n1",
      ref: m.elements[0]!,
      archi_type: 1,
      x: 10, y: 10, w: 120, h: 55,
    });
    return { node, model: m };
  }

  it("Service shape renders pill rect (large rx)", () => {
    const { node, model: m } = makeIconNode("BusinessService");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toMatch(/rx="\d+(\.\d+)?" ry="\d+(\.\d+)?"/);
  });

  it("Event shape renders a path element", () => {
    const { node, model: m } = makeIconNode("BusinessEvent");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("ImplementationEvent also renders event path", () => {
    const { node, model: m } = makeIconNode("ImplementationEvent");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("ApplicationComponent renders three rects (body + 2 nubs)", () => {
    const { node, model: m } = makeIconNode("ApplicationComponent");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("Collaboration shape renders two ellipses", () => {
    const { node, model: m } = makeIconNode("BusinessCollaboration");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<ellipse /g) ?? []).length).toBe(2);
  });

  it("Interface shape renders a circle", () => {
    const { node, model: m } = makeIconNode("BusinessInterface");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<circle ");
  });

  it("Function shape renders a path element", () => {
    const { node, model: m } = makeIconNode("BusinessFunction");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("Process shape renders a path element", () => {
    const { node, model: m } = makeIconNode("BusinessProcess");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("Interaction shape renders two half-ellipse paths", () => {
    const { node, model: m } = makeIconNode("BusinessInteraction");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("Interaction shape renders wider-than-tall node (w > h branch)", () => {
    const m = baseModel("ApplicationInteraction");
    const node = makeNode({ uuid: "n1", ref: m.elements[0]!, archi_type: 1, x: 10, y: 10, w: 200, h: 55 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("Interaction shape renders taller-than-wide node (w <= h branch)", () => {
    const m = baseModel("ApplicationInteraction");
    const node = makeNode({ uuid: "n1", ref: m.elements[0]!, archi_type: 1, x: 10, y: 10, w: 55, h: 120 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });
});

describe("renderViewToSvg – data-object shapes", () => {
  function makeDataNode(type: string) {
    const m: ArchiModel = {
      uuid: "m1", name: "M", desc: null, version: null,
      elements: [{ uuid: "e1", name: type, type, desc: null, props: {} }],
      relationships: [], views: [],
    };
    const node = makeNode({ uuid: "n1", ref: m.elements[0]!, x: 10, y: 10, w: 100, h: 60 });
    return { node, model: m };
  }

  it("DataObject renders rect + header line", () => {
    const { node, model: m } = makeDataNode("DataObject");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<line ");
    expect(svg).toContain("<rect ");
  });

  it("BusinessObject renders data-object shape", () => {
    const { node, model: m } = makeDataNode("BusinessObject");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<line ");
  });

  it("Artifact renders data-object shape", () => {
    const { node, model: m } = makeDataNode("Artifact");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<line ");
  });
});

describe("renderViewToSvg – color and style helpers", () => {
  it("uses derivedLineColor (rgb branch) when line_color is null and fill is rgb", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Node", type: "ApplicationComponent", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], views: [] };
    // fill_color set → rgbStr returns "rgb(...)", line_color null → derivedLineColor("rgb(...)") used
    const node = makeNode({ uuid: "n1", ref: elem, fill_color: { r: 180, g: 200, b: 220, a: 255 }, line_color: null });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    // derivedLineColor: Math.floor(180*0.7)=125, Math.floor(200*0.7)=140, Math.floor(220*0.7)=154
    expect(svg).toContain("rgb(125,140,154)");
  });

  it("applies custom font_size and font_name from node", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Elem", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: elem, font_size: 14, font_name: "Courier,monospace" });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain('font-size="14"');
    expect(svg).toContain('font-family="Courier,monospace"');
  });

  it("applies custom font_color from node", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Elem", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: elem, font_color: { r: 255, g: 0, b: 0, a: 255 } });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain('fill="rgb(255,0,0)"');
  });

  it("OrJunction renders inner white ring", () => {
    const junction: ArchiElement = { uuid: "j1", name: "", type: "OrJunction", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [junction], relationships: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: junction, x: 50, y: 50, w: 14, h: 14, fill_color: null, line_color: null });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('fill="white"');
  });
});

describe("renderViewToSvg – node name edge cases", () => {
  it("uses node.name when set (overrides ref.name)", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Elem Name", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], views: [] };
    const node = makeNode({ uuid: "n1", name: "Override Name", ref: elem });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("Override Name");
    expect(svg).not.toContain("Elem Name");
  });

  it("uses ref.name when node.name is null", () => {
    const elem: ArchiElement = { uuid: "e1", name: "From Ref", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], views: [] };
    const node = makeNode({ uuid: "n1", name: null, ref: elem });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("From Ref");
  });

  it("treats string ref as unresolved (nodeType → Grouping, nodeName → empty)", () => {
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [], relationships: [], views: [] };
    // ref is a raw string UUID (unresolved) — nodeType returns "Grouping"
    const node = makeNode({ uuid: "n1", name: null, ref: "unresolved-uuid" });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    // Grouping shape → dashed border
    expect(svg).toContain('stroke-dasharray="6,4"');
  });

  it("wraps long names across multiple text lines", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Word1 Word2 Word3 Word4 Word5", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], views: [] };
    // Small width forces wrapping
    const node = makeNode({ uuid: "n1", ref: elem, w: 40, h: 80 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    // Multiple <text> elements should appear for wrapped lines
    expect((svg.match(/<text /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("renders top-left label when node has children", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Parent", type: "Node", desc: null, props: {} };
    const child: ArchiElement = { uuid: "e2", name: "Child", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem, child], relationships: [], views: [] };
    const childNode = makeNode({ uuid: "n2", ref: child, x: 10, y: 10, w: 80, h: 40 });
    const parentNode = makeNode({ uuid: "n1", ref: elem, x: 0, y: 0, w: 200, h: 150, nodes: [childNode] });
    const svg = renderViewToSvg(makeView({ nodes: [parentNode] }), m);
    expect(svg).toContain("Parent");
    expect(svg).toContain("Child");
  });
});

describe("renderViewToSvg – connection features", () => {
  const e1: ArchiElement = { uuid: "e1", name: "A", type: "Node", desc: null, props: {} };
  const e2: ArchiElement = { uuid: "e2", name: "B", type: "Node", desc: null, props: {} };
  const baseModel: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [e1, e2], relationships: [], views: [] };

  it("renders connection label from conn.name", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: null, name: "my label" });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), baseModel);
    expect(svg).toContain("my label");
  });

  it("renders connection label from relationship name when conn.name is null", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: "flows to", type: "Flow",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1", name: null });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), m);
    expect(svg).toContain("flows to");
  });

  it("renders connection with bendpoints (waypoints path)", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({
      uuid: "c1", source: "n1", target: "n2", ref: null,
      bendpoints: [{ x: 150, y: 35 }],
    });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), baseModel);
    expect(svg).toContain("<polyline ");
  });

  it("skips connection when source node not in geomMap", () => {
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "no-such-node", target: "n2", ref: null });
    const svg = renderViewToSvg(makeView({ nodes: [n2], conns: [conn] }), baseModel);
    expect(svg).not.toContain("<polyline ");
  });

  it("skips connection when target node not in geomMap", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "no-such-node", ref: null });
    const svg = renderViewToSvg(makeView({ nodes: [n1], conns: [conn] }), baseModel);
    expect(svg).not.toContain("<polyline ");
  });

  it("suppresses Composition arrow when target is visually nested inside source", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: null, type: "Composition",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const childNode = makeNode({ uuid: "n2", ref: e2, x: 10, y: 10, w: 80, h: 40 });
    const parentNode = makeNode({ uuid: "n1", ref: e1, x: 0, y: 0, w: 200, h: 150, nodes: [childNode] });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1" });
    const svg = renderViewToSvg(makeView({ nodes: [parentNode], conns: [conn] }), m);
    expect(svg).not.toContain("<polyline ");
  });

  it("does NOT suppress non-structural relation for nested nodes", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: null, type: "Association",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const childNode = makeNode({ uuid: "n2", ref: e2, x: 10, y: 10, w: 80, h: 40 });
    const parentNode = makeNode({ uuid: "n1", ref: e1, x: 0, y: 0, w: 200, h: 150, nodes: [childNode] });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1" });
    const svg = renderViewToSvg(makeView({ nodes: [parentNode], conns: [conn] }), m);
    expect(svg).toContain("<polyline ");
  });

  it("renders connection with custom line_color", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: null, line_color: { r: 255, g: 0, b: 0, a: 255 } });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), baseModel);
    expect(svg).toContain('stroke="rgb(255,0,0)"');
  });

  it("applies marker-start and marker-end for Composition relation", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: null, type: "Composition",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1" });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), m);
    expect(svg).toContain('marker-start="url(#diamond-filled)"');
  });

  it("sorts Grouping nodes before other nodes", () => {
    const groupElem: ArchiElement = { uuid: "g1", name: "Group", type: "Grouping", desc: null, props: {} };
    const m: ArchiModel = { ...baseModel, elements: [e1, groupElem] };
    const groupNode = makeNode({ uuid: "ng", ref: groupElem, x: 0, y: 0, w: 300, h: 200 });
    const childNode = makeNode({ uuid: "n1", ref: e1, x: 20, y: 20, w: 100, h: 50 });
    const svg = renderViewToSvg(makeView({ nodes: [childNode, groupNode] }), m);
    // Grouping dashed rect should appear before the child rect
    const groupIdx = svg.indexOf('stroke-dasharray="6,4"');
    const childIdx = svg.indexOf("<rect ", groupIdx + 1);
    expect(groupIdx).toBeLessThan(childIdx);
  });
});

// ===========================================================================
// Integration tests – GET /views/:view_id/image
// ===========================================================================

describe("GET /views/:view_id/image", () => {
  it("returns SVG for a real view (default format)", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/svg/);
    // supertest buffers image/* as Buffer; convert to string for content check
    const body = Buffer.isBuffer(res.body) ? res.body.toString() : String(res.body);
    expect(body).toMatch(/^<svg /);
  });

  it("returns SVG when format=svg", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image?format=svg`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/svg/);
  });

  it("returns 404 for unknown view id", async () => {
    const res = await request(app).get(`/views/${UNKNOWN_ID}/image`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("detail");
  });

  it("returns 422 for invalid format", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image?format=gif`);
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("detail");
  });

  it("returns 200 with PNG image when sharp is installed", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image?format=png`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/image\/png/);
  });
});
