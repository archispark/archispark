import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { seedWorkspace } from "@workspace/db";
import * as store from "./store.js";

// Each test runs against a fresh, isolated workspace seeded in the (PGlite) DB.
// organizationId is a plain Keycloak/Phasetwo organization id — no local
// "organizations" table to insert into (organizations live in Keycloak).
let wsId: number;
let orgId: string;

beforeEach(async () => {
  orgId = `org-store-test-${randomUUID()}`;
  wsId = await seedWorkspace(`store-test-${randomUUID()}`, {
    uuid: `id-${randomUUID()}`, name: "Store Test", desc: null, version: null,
    elements: [], relationships: [], propertyDefinitions: [], views: [],
  }, orgId);
});

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

describe("store – elements", () => {
  it("creates, lists and gets an element with properties + documentation", async () => {
    const created = await store.createElement(wsId, {
      name: "App", type: "ApplicationComponent", documentation: "doc",
      properties: [{ property_definition_ref: "status", value: "active" }],
    });
    expect(created.identifier).toBeTruthy();
    expect(created.documentation).toBe("doc");
    expect(created.properties).toHaveLength(1);

    const list = await store.listElements(wsId);
    expect(list).toHaveLength(1);

    const got = await store.getElementById(wsId, created.identifier);
    expect(got.name).toBe("App");
    expect(got.properties[0]!.value).toBe("active");
  });

  it("documentation defaults to null and properties to empty", async () => {
    const created = await store.createElement(wsId, { name: "Bare", type: "Goal" });
    expect(created.documentation).toBeNull();
    expect(created.properties).toEqual([]);
  });

  it("filters list by type and name", async () => {
    await store.createElement(wsId, { name: "Alpha", type: "Goal" });
    await store.createElement(wsId, { name: "Beta", type: "ApplicationComponent" });
    expect(await store.listElements(wsId, "Goal")).toHaveLength(1);
    expect(await store.listElements(wsId, null, "lph")).toHaveLength(1);
    expect(await store.listElements(wsId, "Goal", "zzz")).toHaveLength(0);
  });

  it("listElementTypes returns sorted distinct types", async () => {
    await store.createElement(wsId, { name: "A", type: "Goal" });
    await store.createElement(wsId, { name: "B", type: "ApplicationComponent" });
    await store.createElement(wsId, { name: "C", type: "Goal" });
    expect(await store.listElementTypes(wsId)).toEqual(["ApplicationComponent", "Goal"]);
  });

  it("getElementById throws for unknown id", async () => {
    await expect(store.getElementById(wsId, "nope")).rejects.toThrow(/introuvable/);
  });

  it("updates fields, properties, and leaves omitted fields untouched", async () => {
    const e = await store.createElement(wsId, { name: "Old", type: "Goal", documentation: "keep" });
    await store.updateElement(wsId, e.identifier, { name: "New", type: "BusinessActor" });
    let got = await store.getElementById(wsId, e.identifier);
    expect(got.name).toBe("New");
    expect(got.type).toBe("BusinessActor");
    expect(got.documentation).toBe("keep");

    await store.updateElement(wsId, e.identifier, { documentation: null, properties: [{ property_definition_ref: "k", value: "v" }] });
    got = await store.getElementById(wsId, e.identifier);
    expect(got.documentation).toBeNull();
    expect(got.properties).toHaveLength(1);
  });

  it("updateElement throws for unknown id", async () => {
    await expect(store.updateElement(wsId, "nope", { name: "x" })).rejects.toThrow(/introuvable/);
  });

  it("deletes an element and cascades its relationships and view nodes", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    const b = await store.createElement(wsId, { name: "B", type: "Goal" });
    await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier });
    const view = await store.createView(wsId, { name: "V" });
    await store.createNode(wsId, view.identifier, { element_id: a.identifier });

    await store.deleteElement(wsId, a.identifier);
    expect(await store.listElements(wsId)).toHaveLength(1);
    expect(await store.listRelationships(wsId)).toHaveLength(0);
    expect((await store.getViewById(wsId, view.identifier)).nodes).toHaveLength(0);
  });

  it("deleteElement throws for unknown id", async () => {
    await expect(store.deleteElement(wsId, "nope")).rejects.toThrow(/introuvable/);
  });

  it("listElementsInViews returns element uuids referenced by nodes", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    const view = await store.createView(wsId, { name: "V" });
    await store.createNode(wsId, view.identifier, { element_id: a.identifier });
    expect(await store.listElementsInViews(wsId)).toEqual([a.identifier]);
  });
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

describe("store – relationships", () => {
  async function twoElements() {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    const b = await store.createElement(wsId, { name: "B", type: "ApplicationComponent" });
    return [a, b] as const;
  }

  it("creates a relationship and resolves source/target names + properties", async () => {
    const [a, b] = await twoElements();
    const rel = await store.createRelationship(wsId, {
      type: "Access", source: a.identifier, target: b.identifier, name: "uses",
      documentation: "doc", access_type: "Write",
      properties: [{ property_definition_ref: "k", value: "v" }],
    });
    expect(rel.source).toBe(a.identifier);
    expect(rel.source_name).toBe("A");
    expect(rel.target_name).toBe("B");
    expect(rel.access_type).toBe("Write");
    expect(rel.properties).toHaveLength(1);
  });

  it("validates source and target existence on create", async () => {
    const [a] = await twoElements();
    await expect(store.createRelationship(wsId, { type: "Association", source: "nope", target: a.identifier })).rejects.toThrow(/source/);
    await expect(store.createRelationship(wsId, { type: "Association", source: a.identifier, target: "nope" })).rejects.toThrow(/cible/);
  });

  it("lists and filters relationships, and lists types", async () => {
    const [a, b] = await twoElements();
    await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier });
    await store.createRelationship(wsId, { type: "Composition", source: a.identifier, target: b.identifier });
    expect(await store.listRelationships(wsId)).toHaveLength(2);
    expect(await store.listRelationships(wsId, "Association")).toHaveLength(1);
    expect(await store.listRelationships(wsId, null, a.identifier)).toHaveLength(2);
    expect(await store.listRelationships(wsId, null, null, b.identifier)).toHaveLength(2);
    expect(await store.listRelationshipTypes(wsId)).toEqual(["Association", "Composition"]);
  });

  it("getElementRelationships returns relationships touching an element", async () => {
    const [a, b] = await twoElements();
    await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier });
    expect(await store.getElementRelationships(wsId, a.identifier)).toHaveLength(1);
    expect(await store.getElementRelationships(wsId, b.identifier)).toHaveLength(1);
  });

  it("updates name/source/target with validation, and deletes", async () => {
    const [a, b] = await twoElements();
    const c = await store.createElement(wsId, { name: "C", type: "Goal" });
    const rel = await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier });
    const upd = await store.updateRelationship(wsId, rel.identifier, { name: "x", source: c.identifier });
    expect(upd.name).toBe("x");
    expect(upd.source).toBe(c.identifier);
    await expect(store.updateRelationship(wsId, rel.identifier, { source: "nope" })).rejects.toThrow(/source/);
    await expect(store.updateRelationship(wsId, rel.identifier, { target: "nope" })).rejects.toThrow(/cible/);

    await store.deleteRelationship(wsId, rel.identifier);
    expect(await store.listRelationships(wsId)).toHaveLength(0);
  });

  it("throws for unknown relationship id (get/update/delete)", async () => {
    await expect(store.getRelationshipById(wsId, "nope")).rejects.toThrow(/introuvable/);
    await expect(store.updateRelationship(wsId, "nope", {})).rejects.toThrow(/introuvable/);
    await expect(store.deleteRelationship(wsId, "nope")).rejects.toThrow(/introuvable/);
  });
});

// ---------------------------------------------------------------------------
// Property definitions
// ---------------------------------------------------------------------------

describe("store – property definitions", () => {
  it("CRUD lifecycle with type defaulting", async () => {
    const pd = await store.createPropertyDefinition(wsId, { name: "Status" });
    expect(pd.type).toBe("string");
    expect(await store.listPropertyDefinitions(wsId)).toHaveLength(1);
    expect((await store.getPropertyDefinitionById(wsId, pd.identifier)).name).toBe("Status");

    const updName = await store.updatePropertyDefinition(wsId, pd.identifier, { name: "Phase" });
    expect(updName.name).toBe("Phase");
    expect(updName.type).toBe("string");
    const updType = await store.updatePropertyDefinition(wsId, pd.identifier, { type: "number" });
    expect(updType.type).toBe("number");

    await store.deletePropertyDefinition(wsId, pd.identifier);
    expect(await store.listPropertyDefinitions(wsId)).toHaveLength(0);
  });

  it("delete cascades property values on elements and relationships", async () => {
    const pd = await store.createPropertyDefinition(wsId, { name: "P" });
    const a = await store.createElement(wsId, { name: "A", type: "Goal", properties: [{ property_definition_ref: pd.identifier, value: "x" }, { property_definition_ref: "keep", value: "y" }] });
    const b = await store.createElement(wsId, { name: "B", type: "Goal" });
    const rel = await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier, properties: [{ property_definition_ref: pd.identifier, value: "z" }] });

    await store.deletePropertyDefinition(wsId, pd.identifier);
    const elem = await store.getElementById(wsId, a.identifier);
    expect(elem.properties.find((p) => p.property_definition_ref === pd.identifier)).toBeUndefined();
    expect(elem.properties.find((p) => p.property_definition_ref === "keep")).toBeTruthy();
    const r = await store.getRelationshipById(wsId, rel.identifier);
    expect(r.properties.find((p) => p.property_definition_ref === pd.identifier)).toBeUndefined();
  });

  it("throws for unknown id (get/update/delete)", async () => {
    await expect(store.getPropertyDefinitionById(wsId, "nope")).rejects.toThrow(/introuvable/);
    await expect(store.updatePropertyDefinition(wsId, "nope", { name: "x" })).rejects.toThrow(/introuvable/);
    await expect(store.deletePropertyDefinition(wsId, "nope")).rejects.toThrow(/introuvable/);
  });
});

// ---------------------------------------------------------------------------
// Views / nodes / connections
// ---------------------------------------------------------------------------

describe("store – views, nodes, connections", () => {
  it("creates/updates/lists/deletes views", async () => {
    const v = await store.createView(wsId, { name: "V", viewpoint: "Layered", documentation: "doc" });
    expect(v.viewpoint).toBe("Layered");
    expect(v.nodes).toEqual([]);
    expect(await store.listViews(wsId)).toHaveLength(1);

    const upd = await store.updateView(wsId, v.identifier, { name: "Renamed", documentation: null, viewpoint: null });
    expect(upd.name).toBe("Renamed");

    await store.deleteView(wsId, v.identifier);
    expect(await store.listViews(wsId)).toHaveLength(0);
  });

  it("view operations throw for unknown view", async () => {
    await expect(store.getViewById(wsId, "nope")).rejects.toThrow(/introuvable/);
    await expect(store.updateView(wsId, "nope", { name: "x" })).rejects.toThrow(/introuvable/);
    await expect(store.deleteView(wsId, "nope")).rejects.toThrow(/introuvable/);
  });

  it("creates nodes with coordinates and validates view + element", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    const v = await store.createView(wsId, { name: "V" });
    const node = await store.createNode(wsId, v.identifier, { element_id: a.identifier, x: 10, y: 20, w: 120, h: 55 });
    expect(node.element_ref).toBe(a.identifier);
    expect(node.x).toBe(10);
    expect(node.w).toBe(120);

    await expect(store.createNode(wsId, "no-view", { element_id: a.identifier })).rejects.toThrow(/introuvable/);
    await expect(store.createNode(wsId, v.identifier, { element_id: "no-elem" })).rejects.toThrow(/introuvable/);
  });

  it("updates and deletes nodes (with connection cleanup)", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    const v = await store.createView(wsId, { name: "V" });
    const n1 = await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const n2 = await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const upd = await store.updateViewNode(wsId, v.identifier, n1.identifier, { x: 5, name: "renamed" });
    expect(upd.x).toBe(5);
    expect(upd.name).toBe("renamed");

    await store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: n2.identifier });
    await store.deleteViewNode(wsId, v.identifier, n1.identifier);
    const detail = await store.getViewById(wsId, v.identifier);
    expect(detail.nodes).toHaveLength(1);
    expect(detail.connections).toHaveLength(0);

    await expect(store.updateViewNode(wsId, v.identifier, "nope", {})).rejects.toThrow(/introuvable/);
    await expect(store.deleteViewNode(wsId, v.identifier, "nope")).rejects.toThrow(/introuvable/);
  });

  it("creates/updates/deletes connections with validation", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    const b = await store.createElement(wsId, { name: "B", type: "Goal" });
    const rel = await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier });
    const v = await store.createView(wsId, { name: "V" });
    const n1 = await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const n2 = await store.createNode(wsId, v.identifier, { element_id: b.identifier });

    const conn = await store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: n2.identifier, relationship_id: rel.identifier, name: "c", source_side: "right", target_side: "left" });
    expect(conn.source).toBe(n1.identifier);
    expect(conn.relationship_ref).toBe(rel.identifier);
    expect(conn.source_side).toBe("right");

    await expect(store.createViewConnection(wsId, v.identifier, { source: "nope", target: n2.identifier })).rejects.toThrow(/source/);
    await expect(store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: "nope" })).rejects.toThrow(/cible/);
    await expect(store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: n2.identifier, relationship_id: "nope" })).rejects.toThrow(/introuvable/);

    const upd = await store.updateViewConnection(wsId, v.identifier, conn.identifier, { name: "c2", source: n2.identifier, target: n1.identifier });
    expect(upd.name).toBe("c2");
    expect(upd.source).toBe(n2.identifier);
    await expect(store.updateViewConnection(wsId, v.identifier, conn.identifier, { source: "nope" })).rejects.toThrow(/source/);
    await expect(store.updateViewConnection(wsId, v.identifier, conn.identifier, { target: "nope" })).rejects.toThrow(/cible/);
    await expect(store.updateViewConnection(wsId, v.identifier, "nope", {})).rejects.toThrow(/introuvable/);

    await store.deleteViewConnection(wsId, v.identifier, conn.identifier);
    expect((await store.getViewById(wsId, v.identifier)).connections).toHaveLength(0);
    await expect(store.deleteViewConnection(wsId, v.identifier, "nope")).rejects.toThrow(/introuvable/);
  });
});

// ---------------------------------------------------------------------------
// Model info / loadModel
// ---------------------------------------------------------------------------

describe("store – model info & loadModel", () => {
  it("getModelInfo returns counts", async () => {
    await store.createElement(wsId, { name: "A", type: "Goal" });
    await store.createView(wsId, { name: "V" });
    const info = await store.getModelInfo(wsId);
    expect(info.element_count).toBe(1);
    expect(info.view_count).toBe(1);
    expect(info.relationship_count).toBe(0);
  });

  it("getModelInfo throws for unknown workspace", async () => {
    await expect(store.getModelInfo(999999)).rejects.toThrow(/introuvable/);
  });

  it("loadModel returns the full object graph", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "Goal" });
    await store.createView(wsId, { name: "V" });
    const model = await store.loadModel(wsId);
    expect(model.elements.map((e) => e.uuid)).toContain(a.identifier);
    expect(model.views).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// XML export / import
// ---------------------------------------------------------------------------

describe("store – XML export/import", () => {
  it("exportModelToXml returns valid XML string", async () => {
    await store.createElement(wsId, { name: "App", type: "ApplicationComponent" });
    const xml = await store.exportModelToXml(wsId);
    expect(xml).toContain("<?xml");
    expect(xml).toContain("App");
  });

  it("importModelFromXml round-trips a model", async () => {
    await store.createElement(wsId, { name: "Srv", type: "ApplicationService" });
    const xml = await store.exportModelToXml(wsId);
    const info = await store.importModelFromXml(wsId, xml);
    expect(info.element_count).toBeGreaterThanOrEqual(1);
  });

  it("importModelFromXml throws on invalid XML", async () => {
    await expect(store.importModelFromXml(wsId, "not-xml")).rejects.toThrow(/parsing XML/);
  });
});

// ---------------------------------------------------------------------------
// computeStatusCounts branch coverage
// ---------------------------------------------------------------------------

describe("store – view conflict counting", () => {
  it("listViews shows ok_count=0 and conflict_count=0 for connection without relationship", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "ApplicationComponent" });
    const b = await store.createElement(wsId, { name: "B", type: "ApplicationComponent" });
    const v = await store.createView(wsId, { name: "V" });
    const n1 = await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const n2 = await store.createNode(wsId, v.identifier, { element_id: b.identifier });
    // Connection without a relationship → relUuid is null → should be skipped in computeStatusCounts
    await store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: n2.identifier });
    const vws = await store.listViews(wsId);
    const found = vws.find((vw) => vw.identifier === v.identifier);
    expect(found).toBeDefined();
    expect(found!.ok_count).toBe(0);
    expect(found!.conflict_count).toBe(0);
  });

  it("listViews shows ok_count > 0 for allowed Association relationship", async () => {
    // Association is always allowed → ok branch in computeStatusCounts
    const a = await store.createElement(wsId, { name: "A", type: "ApplicationComponent" });
    const b = await store.createElement(wsId, { name: "B", type: "BusinessProcess" });
    const rel = await store.createRelationship(wsId, { type: "Association", source: a.identifier, target: b.identifier });
    const v = await store.createView(wsId, { name: "V" });
    const n1 = await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const n2 = await store.createNode(wsId, v.identifier, { element_id: b.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: n2.identifier, relationship_id: rel.identifier });
    const vws = await store.listViews(wsId);
    const found = vws.find((vw) => vw.identifier === v.identifier);
    expect(found).toBeDefined();
    expect(found!.ok_count).toBeGreaterThan(0);
    expect(found!.conflict_count).toBe(0);
  });

  it("listViews shows conflict_count > 0 for incompatible Specialization relationship", async () => {
    // Specialization between different element types is not allowed
    const a = await store.createElement(wsId, { name: "A", type: "ApplicationComponent" });
    const b = await store.createElement(wsId, { name: "B", type: "BusinessProcess" });
    const rel = await store.createRelationship(wsId, { type: "Specialization", source: a.identifier, target: b.identifier });
    const v = await store.createView(wsId, { name: "V2" });
    const n1 = await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const n2 = await store.createNode(wsId, v.identifier, { element_id: b.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: n1.identifier, target: n2.identifier, relationship_id: rel.identifier });
    const vws = await store.listViews(wsId);
    const found = vws.find((vw) => vw.identifier === v.identifier);
    expect(found).toBeDefined();
    expect(found!.conflict_count).toBeGreaterThan(0);
    expect(found!.ok_count).toBe(0);
  });

  it("isRelationshipAllowed covers Composition, Realization, Triggering via listViews", async () => {
    // Composition: active→active is structural → ok
    const comp1 = await store.createElement(wsId, { name: "C1", type: "ApplicationComponent" });
    const comp2 = await store.createElement(wsId, { name: "C2", type: "ApplicationComponent" });
    const relComp = await store.createRelationship(wsId, { type: "Composition", source: comp1.identifier, target: comp2.identifier });
    // Realization: behavior→passive → ok
    const beh = await store.createElement(wsId, { name: "Svc", type: "ApplicationService" });
    const pas = await store.createElement(wsId, { name: "Obj", type: "DataObject" });
    const relReal = await store.createRelationship(wsId, { type: "Realization", source: beh.identifier, target: pas.identifier });
    // Triggering: behavior→behavior → ok
    const beh2 = await store.createElement(wsId, { name: "Func", type: "ApplicationFunction" });
    const relTrig = await store.createRelationship(wsId, { type: "Triggering", source: beh.identifier, target: beh2.identifier });

    const v = await store.createView(wsId, { name: "V3" });
    const nC1 = await store.createNode(wsId, v.identifier, { element_id: comp1.identifier });
    const nC2 = await store.createNode(wsId, v.identifier, { element_id: comp2.identifier });
    const nBeh = await store.createNode(wsId, v.identifier, { element_id: beh.identifier });
    const nPas = await store.createNode(wsId, v.identifier, { element_id: pas.identifier });
    const nBeh2 = await store.createNode(wsId, v.identifier, { element_id: beh2.identifier });

    await store.createViewConnection(wsId, v.identifier, { source: nC1.identifier, target: nC2.identifier, relationship_id: relComp.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: nBeh.identifier, target: nPas.identifier, relationship_id: relReal.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: nBeh.identifier, target: nBeh2.identifier, relationship_id: relTrig.identifier });

    const vws = await store.listViews(wsId);
    const found = vws.find((vw) => vw.identifier === v.identifier);
    expect(found).toBeDefined();
    expect(found!.ok_count).toBeGreaterThanOrEqual(3);
    expect(found!.conflict_count).toBe(0);
  });

  it("isRelationshipAllowed covers Assignment and Realization false-branches via listViews", async () => {
    // Assignment: motivation→motivation is NOT allowed (not active, not behavior→passive)
    const goal1 = await store.createElement(wsId, { name: "G1", type: "Goal" });
    const goal2 = await store.createElement(wsId, { name: "G2", type: "Goal" });
    const relAssign = await store.createRelationship(wsId, { type: "Assignment", source: goal1.identifier, target: goal2.identifier });
    // Realization: active→active is NOT allowed (not behavior, not implementation)
    const comp1 = await store.createElement(wsId, { name: "X1", type: "ApplicationComponent" });
    const comp2 = await store.createElement(wsId, { name: "X2", type: "ApplicationComponent" });
    const relReal = await store.createRelationship(wsId, { type: "Realization", source: comp1.identifier, target: comp2.identifier });

    const v = await store.createView(wsId, { name: "VFalse" });
    const nG1 = await store.createNode(wsId, v.identifier, { element_id: goal1.identifier });
    const nG2 = await store.createNode(wsId, v.identifier, { element_id: goal2.identifier });
    const nC1 = await store.createNode(wsId, v.identifier, { element_id: comp1.identifier });
    const nC2 = await store.createNode(wsId, v.identifier, { element_id: comp2.identifier });

    await store.createViewConnection(wsId, v.identifier, { source: nG1.identifier, target: nG2.identifier, relationship_id: relAssign.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: nC1.identifier, target: nC2.identifier, relationship_id: relReal.identifier });

    const vws = await store.listViews(wsId);
    const found = vws.find((vw) => vw.identifier === v.identifier);
    expect(found).toBeDefined();
    expect(found!.conflict_count).toBeGreaterThanOrEqual(2);
  });

  it("isRelationshipAllowed covers Access, Influence, Flow via listViews", async () => {
    // Access: behavior→passive → ok
    const svc = await store.createElement(wsId, { name: "Svc", type: "ApplicationService" });
    const obj = await store.createElement(wsId, { name: "Obj", type: "DataObject" });
    const relAccess = await store.createRelationship(wsId, { type: "Access", source: svc.identifier, target: obj.identifier });
    // Influence: motivation→anything → ok
    const goal = await store.createElement(wsId, { name: "Goal", type: "Goal" });
    const comp = await store.createElement(wsId, { name: "Comp", type: "ApplicationComponent" });
    const relInfl = await store.createRelationship(wsId, { type: "Influence", source: goal.identifier, target: comp.identifier });
    // Flow: behavior→behavior → ok (tests Flow branch at line 103-104)
    const func1 = await store.createElement(wsId, { name: "F1", type: "ApplicationFunction" });
    const func2 = await store.createElement(wsId, { name: "F2", type: "ApplicationFunction" });
    const relFlow = await store.createRelationship(wsId, { type: "Flow", source: func1.identifier, target: func2.identifier });

    const v = await store.createView(wsId, { name: "V4" });
    const nSvc = await store.createNode(wsId, v.identifier, { element_id: svc.identifier });
    const nObj = await store.createNode(wsId, v.identifier, { element_id: obj.identifier });
    const nGoal = await store.createNode(wsId, v.identifier, { element_id: goal.identifier });
    const nComp = await store.createNode(wsId, v.identifier, { element_id: comp.identifier });
    const nF1 = await store.createNode(wsId, v.identifier, { element_id: func1.identifier });
    const nF2 = await store.createNode(wsId, v.identifier, { element_id: func2.identifier });

    await store.createViewConnection(wsId, v.identifier, { source: nSvc.identifier, target: nObj.identifier, relationship_id: relAccess.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: nGoal.identifier, target: nComp.identifier, relationship_id: relInfl.identifier });
    await store.createViewConnection(wsId, v.identifier, { source: nF1.identifier, target: nF2.identifier, relationship_id: relFlow.identifier });

    const vws = await store.listViews(wsId);
    const found = vws.find((vw) => vw.identifier === v.identifier);
    expect(found).toBeDefined();
    expect(found!.ok_count).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// updateRelationship optional fields (access_type, is_directed, influence_strength)
// ---------------------------------------------------------------------------

describe("store – relationship optional fields", () => {
  it("updateRelationship with access_type, is_directed, influence_strength and properties", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "ApplicationService" });
    const b = await store.createElement(wsId, { name: "B", type: "DataObject" });
    const pd = await store.createPropertyDefinition(wsId, { name: "status", type: "string" });
    const rel = await store.createRelationship(wsId, { type: "Access", source: a.identifier, target: b.identifier });
    const upd = await store.updateRelationship(wsId, rel.identifier, {
      access_type: "Read",
      is_directed: true,
      influence_strength: "high",
      properties: [{ property_definition_ref: pd.identifier, value: "ok" }],
    });
    expect(upd.identifier).toBe(rel.identifier);
  });

  it("getElementViews returns views containing the element", async () => {
    const a = await store.createElement(wsId, { name: "A", type: "ApplicationComponent" });
    const v = await store.createView(wsId, { name: "ViewWithA" });
    await store.createNode(wsId, v.identifier, { element_id: a.identifier });
    const result = await store.getElementViews(wsId, a.identifier);
    expect(result.map((r) => r.identifier)).toContain(v.identifier);
  });

  it("getElementViews returns empty when element has no nodes", async () => {
    const a = await store.createElement(wsId, { name: "Orphan", type: "ApplicationComponent" });
    const result = await store.getElementViews(wsId, a.identifier);
    expect(result).toHaveLength(0);
  });
});
