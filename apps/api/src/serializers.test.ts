import { describe, it, expect } from "vitest";
import { hexToRgb, elementOut, relOut, nodeOut, connectionOut, viewOut, pdOut } from "./serializers.js";
import type { ArchiNode, ArchiConnection, ArchiRelationship, ArchiView, ArchiElement } from "./model.js";

const baseNode = (o: Partial<ArchiNode> = {}): ArchiNode => ({
  uuid: "n1", name: null, ref: null, x: null, y: null, w: null, h: null,
  fill_color: null, line_color: null, font_name: null, font_size: null, font_color: null,
  line_width: null, archi_type: null, nodes: [], ...o,
});

const baseConn = (o: Partial<ArchiConnection> = {}): ArchiConnection => ({
  uuid: "c1", name: null, ref: null, source: null, target: null,
  line_color: null, font_name: null, font_size: null, font_color: null, line_width: null, ...o,
});

const baseRel = (o: Partial<ArchiRelationship> = {}): ArchiRelationship => ({
  uuid: "r1", name: null, type: "Association", source: "s", target: "t", desc: null, props: {},
  access_type: null, is_directed: null, influence_strength: null, ...o,
});

describe("hexToRgb", () => {
  it("parses a 6-digit hex (with/without #)", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("returns null for empty/invalid input", () => {
    expect(hexToRgb(null)).toBeNull();
    expect(hexToRgb("")).toBeNull();
    expect(hexToRgb("xyz")).toBeNull();
    expect(hexToRgb("12345")).toBeNull();
  });
});

describe("node/connection style serialization", () => {
  it("nodeOut style is null when no style attributes set", () => {
    expect(nodeOut(baseNode()).style).toBeNull();
  });
  it("nodeOut emits style when a fill color is present", () => {
    const style = nodeOut(baseNode({ fill_color: { r: 1, g: 2, b: 3, a: null } })).style;
    expect(style?.fill_color).toEqual({ r: 1, g: 2, b: 3 });
  });
  it("nodeOut emits style when only line width is present", () => {
    expect(nodeOut(baseNode({ line_width: 2 })).style?.line_width).toBe(2);
  });
  it("nodeOut font is built from font_name / font_size / font_color", () => {
    const style = nodeOut(baseNode({ font_name: "Arial", font_size: 9, font_color: { r: 5, g: 6, b: 7, a: null } })).style;
    expect(style?.font).toEqual({ name: "Arial", size: 9, color: { r: 5, g: 6, b: 7 } });
  });
  it("connectionOut style null when bare, set when styled", () => {
    expect(connectionOut(baseConn()).style).toBeNull();
    expect(connectionOut(baseConn({ line_color: { r: 0, g: 0, b: 0, a: null } })).style?.line_color).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("nodeOut rounds coordinates and resolves object ref", () => {
    const el: ArchiElement = { uuid: "e1", name: "E", type: "Goal", desc: null, props: {} };
    const out = nodeOut(baseNode({ ref: el, x: 10.6, y: 20.4, w: 100, h: 50 }));
    expect(out.element_ref).toBe("e1");
    expect(out.x).toBe(11);
    expect(out.y).toBe(20);
  });
});

describe("relOut modifiers by type", () => {
  it("includes access_type only for Access", () => {
    expect(relOut(baseRel({ type: "Access", access_type: "Write" })).access_type).toBe("Write");
    expect(relOut(baseRel({ type: "Association", access_type: "Write" })).access_type).toBeNull();
  });
  it("includes is_directed only for Association", () => {
    expect(relOut(baseRel({ type: "Association", is_directed: true })).is_directed).toBe(true);
    expect(relOut(baseRel({ type: "Flow", is_directed: true })).is_directed).toBeNull();
  });
  it("includes modifier only for Influence", () => {
    expect(relOut(baseRel({ type: "Influence", influence_strength: "++" })).modifier).toBe("++");
    expect(relOut(baseRel({ type: "Association", influence_strength: "++" })).modifier).toBeNull();
  });
  it("resolves source/target names when given element objects", () => {
    const s: ArchiElement = { uuid: "s1", name: "Src", type: "Goal", desc: null, props: {} };
    const t: ArchiElement = { uuid: "t1", name: "Tgt", type: "Goal", desc: null, props: {} };
    const out = relOut(baseRel({ source: s, target: t }));
    expect(out.source).toBe("s1");
    expect(out.source_name).toBe("Src");
    expect(out.target_name).toBe("Tgt");
  });
});

describe("element / view / property-definition serialization", () => {
  it("elementOut maps properties", () => {
    const e: ArchiElement = { uuid: "e1", name: "E", type: "Goal", desc: "d", props: { k: "v" } };
    const out = elementOut(e);
    expect(out.documentation).toBe("d");
    expect(out.properties).toEqual([{ property_definition_ref: "k", value: "v" }]);
  });
  it("viewOut returns counts in summary, nodes/connections in detail", () => {
    const v: ArchiView = { uuid: "v1", name: "V", desc: null, primary_viewpoint: null, nodes: [baseNode()], conns: [baseConn()] };
    const summary = viewOut(v);
    expect(summary.node_count).toBe(1);
    expect(summary).not.toHaveProperty("nodes");
    const detail = viewOut(v, true);
    expect(detail.nodes).toHaveLength(1);
    expect(detail.connections).toHaveLength(1);
  });
  it("pdOut maps a property definition", () => {
    expect(pdOut({ uuid: "p1", name: "P", type: "string" })).toEqual({ identifier: "p1", name: "P", type: "string" });
  });
});
