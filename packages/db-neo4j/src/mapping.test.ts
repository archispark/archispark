import { describe, it, expect } from "vitest";
import type { ArchiModel, ArchiNode } from "@workspace/db";
import { buildNeo4jParams, toNeo4jRelationshipType } from "./mapping.js";

function node(partial: Partial<ArchiNode> & Pick<ArchiNode, "uuid">): ArchiNode {
  return {
    name: null,
    ref: null,
    x: null,
    y: null,
    w: null,
    h: null,
    fill_color: null,
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    archi_type: null,
    nodes: [],
    ...partial,
  };
}

function emptyModel(): ArchiModel {
  return {
    uuid: "id-model-1",
    name: "Test model",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
  };
}

function testOrg() {
  return { id: 1, slug: "acme", name: "Acme" };
}

describe("toNeo4jRelationshipType", () => {
  it("uppercases the ArchiMate type name", () => {
    expect(toNeo4jRelationshipType("Composition")).toBe("COMPOSITION");
  });
});

describe("buildNeo4jParams", () => {
  it("resolves element and relationship property names via propertyDefinitions", () => {
    const model = emptyModel();
    model.propertyDefinitions = [{ uuid: "pd-1", name: "Owner", type: "string" }];
    model.elements = [{ uuid: "el-1", name: "App A", type: "ApplicationComponent", desc: null, props: { "pd-1": "Team X" } }];
    model.relationships = [
      {
        uuid: "rel-1",
        name: null,
        type: "Serving",
        source: "el-1",
        target: "el-1",
        desc: null,
        props: { "pd-1": "Team Y" },
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
    ];

    const params = buildNeo4jParams(model, testOrg());

    expect(params.elementProperties).toEqual([
      { ownerId: "el-1", definitionId: "pd-1", name: "Owner", value: "Team X", organizationId: 1 },
    ]);
    expect(params.relationshipsByType.get("SERVING")![0]!.properties).toEqual({ Owner: "Team Y" });
  });

  it("computes each element's ArchiMate layer from its type", () => {
    const model = emptyModel();
    model.elements = [
      { uuid: "el-1", name: "App A", type: "ApplicationComponent", desc: null, props: {} },
      { uuid: "el-2", name: "Proc B", type: "BusinessProcess", desc: null, props: {} },
    ];

    const params = buildNeo4jParams(model, testOrg());

    expect(params.elements).toEqual([
      { id: "el-1", name: "App A", type: "ApplicationComponent", layer: "Application", documentation: null, organizationId: 1 },
      { id: "el-2", name: "Proc B", type: "BusinessProcess", layer: "Business", documentation: null, organizationId: 1 },
    ]);
  });

  it("falls back to the raw definition uuid when no propertyDefinition matches", () => {
    const model = emptyModel();
    model.elements = [{ uuid: "el-1", name: "App A", type: "ApplicationComponent", desc: null, props: { "pd-missing": "x" } }];

    const params = buildNeo4jParams(model, testOrg());

    expect(params.elementProperties[0]!.name).toBe("pd-missing");
  });

  it("groups relationships by uppercased type and preserves the original ArchiMate type", () => {
    const model = emptyModel();
    model.relationships = [
      {
        uuid: "rel-1",
        name: "flows to",
        type: "Flow",
        source: "el-1",
        target: "el-2",
        desc: null,
        props: {},
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
    ];

    const params = buildNeo4jParams(model, testOrg());

    expect([...params.relationshipsByType.keys()]).toEqual(["FLOW"]);
    expect(params.relationshipsByType.get("FLOW")).toEqual([
      {
        id: "rel-1",
        sourceId: "el-1",
        targetId: "el-2",
        name: "flows to",
        accessType: null,
        archiType: "Flow",
        organizationId: 1,
        properties: {},
      },
    ]);
  });

  it("resolves source/target from a full ArchiElement or falls back to a raw uuid string", () => {
    const model = emptyModel();
    const elA = { uuid: "el-a", name: "A", type: "ApplicationComponent", desc: null, props: {} };
    const elB = { uuid: "el-b", name: "B", type: "ApplicationComponent", desc: null, props: {} };
    model.relationships = [
      {
        uuid: "rel-1",
        name: null,
        type: "Association",
        source: elA,
        target: elB,
        desc: null,
        props: {},
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
      {
        uuid: "rel-2",
        name: null,
        type: "Association",
        source: "el-c",
        target: "el-d",
        desc: null,
        props: {},
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
    ];

    const params = buildNeo4jParams(model, testOrg());

    const [relObj, relStr] = params.relationshipsByType.get("ASSOCIATION")!;
    expect(relObj).toMatchObject({ sourceId: "el-a", targetId: "el-b" });
    expect(relStr).toMatchObject({ sourceId: "el-c", targetId: "el-d" });
  });

  it("falls back to the raw definition uuid for a relationship property with no matching definition", () => {
    const model = emptyModel();
    model.relationships = [
      {
        uuid: "rel-1",
        name: null,
        type: "Serving",
        source: "el-1",
        target: "el-2",
        desc: null,
        props: { "pd-missing": "x" },
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
    ];

    const params = buildNeo4jParams(model, testOrg());

    expect(params.relationshipsByType.get("SERVING")![0]!.properties).toEqual({ "pd-missing": "x" });
  });

  it("rejects a relationship type that would be unsafe to interpolate into Cypher", () => {
    const model = emptyModel();
    model.relationships = [
      {
        uuid: "rel-1",
        name: null,
        type: "Foo-Bar",
        source: "el-1",
        target: "el-2",
        desc: null,
        props: {},
        access_type: null,
        is_directed: null,
        influence_strength: null,
      },
    ];

    expect(() => buildNeo4jParams(model, testOrg())).toThrow(/Type de relation invalide/);
  });

  it("flattens nested view nodes, resolving refs to element uuids", () => {
    const model = emptyModel();
    model.views = [
      {
        uuid: "view-1",
        name: "Overview",
        desc: null,
        primary_viewpoint: null,
        conns: [],
        nodes: [
          node({ uuid: "n-group", ref: null, nodes: [node({ uuid: "n-child", ref: "el-1" })] }),
          node({ uuid: "n-2", ref: { uuid: "el-2", name: "B", type: "ApplicationComponent", desc: null, props: {} } }),
        ],
      },
    ];

    const params = buildNeo4jParams(model, testOrg());

    expect(params.views).toEqual([
      { id: "view-1", name: "Overview", elementIds: expect.arrayContaining(["el-1", "el-2"]), organizationId: 1 },
    ]);
    expect(params.views[0]!.elementIds).toHaveLength(2);
  });
});
