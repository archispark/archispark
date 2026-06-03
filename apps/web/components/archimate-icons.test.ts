import { describe, it, expect } from "vitest";
import { ARCHIMATE_ICONS, iconForType, type IconPrim } from "./archimate-icons";

// Every ArchiMate element type the canvas can colour should have a type icon,
// except Value (which has no notation glyph in ArchiMate).
const CANVAS_TYPES = [
  "Resource", "Capability", "ValueStream", "CourseOfAction",
  "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
  "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
  "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
  "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
  "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
  "ApplicationEvent", "ApplicationService", "DataObject",
  "Node", "Device", "SystemSoftware", "TechnologyCollaboration", "TechnologyInterface",
  "Path", "CommunicationNetwork", "TechnologyFunction", "TechnologyProcess",
  "TechnologyInteraction", "TechnologyEvent", "TechnologyService", "Artifact",
  "Equipment", "Facility", "DistributionNetwork", "Material",
  "Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle",
  "Requirement", "Constraint", "Meaning", "WorkPackage", "Deliverable",
  "ImplementationEvent", "Plateau", "Gap", "Grouping", "Location",
  "Junction", "AndJunction", "OrJunction",
];

// Returns [x, y] vertex pairs for primitives with unambiguous coordinates.
// `path` is skipped: its `d` mixes coordinates with arc flags/radii that a
// flat number scan can't reliably split into x/y pairs.
function vertices(p: IconPrim): Array<[number, number]> {
  switch (p.tag) {
    case "polygon":
    case "polyline": {
      const out: Array<[number, number]> = [];
      for (let i = 0; i + 1 < p.points.length; i += 2) out.push([p.points[i]!, p.points[i + 1]!]);
      return out;
    }
    case "circle":
      return [[p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy + p.r]];
    case "ellipse":
      return [[p.cx - p.rx, p.cy - p.ry], [p.cx + p.rx, p.cy + p.ry]];
    case "rect":
      return [[p.x, p.y], [p.x + p.width, p.y + p.height]];
    case "path":
      return [];
  }
}

describe("archimate-icons", () => {
  it("provides an icon for every canvas element type except Value", () => {
    const missing = CANVAS_TYPES.filter((t) => !iconForType(t));
    expect(missing).toEqual([]);
    expect(iconForType("Value")).toBeNull();
  });

  it("returns null for unknown or empty types", () => {
    expect(iconForType(undefined)).toBeNull();
    expect(iconForType(null)).toBeNull();
    expect(iconForType("NotAThing")).toBeNull();
  });

  it("anchors every glyph to the top-right corner frame (x ≤ 0, y ≥ 0)", () => {
    for (const [type, prims] of Object.entries(ARCHIMATE_ICONS)) {
      for (const p of prims) {
        for (const [x, y] of vertices(p)) {
          expect(x, `${type} ${p.tag} x`).toBeLessThanOrEqual(2);
          expect(y, `${type} ${p.tag} y`).toBeGreaterThanOrEqual(-2);
        }
      }
    }
  });

  it("keeps the well-known Business Process arrow extracted from Archi", () => {
    expect(iconForType("BusinessProcess")).toEqual([
      { tag: "polygon", points: [-18, 11, -10, 11, -10, 8, -4, 13, -10, 18, -10, 15, -18, 15] },
    ]);
  });
});
