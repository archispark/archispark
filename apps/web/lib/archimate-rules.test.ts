import { describe, it, expect } from "vitest";
import {
  categoryOf,
  allowedRelationships,
  isRelationshipAllowed,
  ARCHIMATE_RELATIONSHIP_TYPES,
} from "./archimate-rules";

describe("categoryOf", () => {
  it("returns 'active' for ApplicationComponent", () => {
    expect(categoryOf("ApplicationComponent")).toBe("active");
  });

  it("returns 'behavior' for BusinessProcess", () => {
    expect(categoryOf("BusinessProcess")).toBe("behavior");
  });

  it("returns 'passive' for DataObject", () => {
    expect(categoryOf("DataObject")).toBe("passive");
  });

  it("returns 'motivation' for Goal", () => {
    expect(categoryOf("Goal")).toBe("motivation");
  });

  it("returns 'strategy' for Resource", () => {
    expect(categoryOf("Resource")).toBe("strategy");
  });

  it("returns 'implementation' for WorkPackage", () => {
    expect(categoryOf("WorkPackage")).toBe("implementation");
  });

  it("returns 'composite' for Grouping", () => {
    expect(categoryOf("Grouping")).toBe("composite");
  });

  it("returns 'junction' for Junction", () => {
    expect(categoryOf("Junction")).toBe("junction");
  });

  it("returns 'other' for unknown type", () => {
    expect(categoryOf("UnknownType")).toBe("other");
  });

  it("returns 'other' when no type given", () => {
    expect(categoryOf(undefined)).toBe("other");
    expect(categoryOf("")).toBe("other");
  });
});

describe("allowedRelationships", () => {
  it("returns all types when no source/target given", () => {
    const all = allowedRelationships();
    expect(all).toEqual([...ARCHIMATE_RELATIONSHIP_TYPES]);
  });

  it("always includes Association", () => {
    expect(allowedRelationships("ApplicationComponent", "BusinessActor")).toContain("Association");
  });

  it("includes Specialization for same type", () => {
    const rels = allowedRelationships("ApplicationComponent", "ApplicationComponent");
    expect(rels).toContain("Specialization");
  });

  it("includes Composition between structural elements", () => {
    const rels = allowedRelationships("ApplicationComponent", "DataObject");
    expect(rels).toContain("Composition");
    expect(rels).toContain("Aggregation");
  });

  it("includes Assignment from active to behavior", () => {
    const rels = allowedRelationships("BusinessActor", "BusinessProcess");
    expect(rels).toContain("Assignment");
  });

  it("includes Assignment from active to passive", () => {
    const rels = allowedRelationships("ApplicationComponent", "DataObject");
    expect(rels).toContain("Assignment");
  });

  it("includes Assignment from behavior to passive", () => {
    const rels = allowedRelationships("ApplicationFunction", "DataObject");
    expect(rels).toContain("Assignment");
  });

  it("includes Realization from behavior to passive", () => {
    const rels = allowedRelationships("ApplicationFunction", "DataObject");
    expect(rels).toContain("Realization");
  });

  it("includes Realization from behavior to behavior", () => {
    const rels = allowedRelationships("ApplicationFunction", "ApplicationService");
    expect(rels).toContain("Realization");
  });

  it("includes Realization from active to behavior", () => {
    const rels = allowedRelationships("ApplicationComponent", "ApplicationService");
    expect(rels).toContain("Realization");
  });

  it("includes Realization from implementation layer", () => {
    const rels = allowedRelationships("WorkPackage", "Goal");
    expect(rels).toContain("Realization");
  });

  it("includes Realization to motivation target", () => {
    const rels = allowedRelationships("ApplicationFunction", "Goal");
    expect(rels).toContain("Realization");
  });

  it("includes Serving between active/behavior", () => {
    const rels = allowedRelationships("ApplicationComponent", "BusinessProcess");
    expect(rels).toContain("Serving");
  });

  it("includes Triggering and Flow between behaviors", () => {
    const rels = allowedRelationships("BusinessProcess", "ApplicationFunction");
    expect(rels).toContain("Triggering");
    expect(rels).toContain("Flow");
  });

  it("includes Flow between active elements", () => {
    const rels = allowedRelationships("ApplicationComponent", "BusinessActor");
    expect(rels).toContain("Flow");
  });

  it("includes Access between behavior and passive", () => {
    const rels = allowedRelationships("ApplicationFunction", "DataObject");
    expect(rels).toContain("Access");
  });

  it("includes Access between passive and behavior", () => {
    const rels = allowedRelationships("DataObject", "ApplicationFunction");
    expect(rels).toContain("Access");
  });

  it("includes Influence when source is motivation", () => {
    const rels = allowedRelationships("Goal", "ApplicationComponent");
    expect(rels).toContain("Influence");
  });

  it("includes Influence when target is motivation", () => {
    const rels = allowedRelationships("ApplicationComponent", "Goal");
    expect(rels).toContain("Influence");
  });

  it("includes Triggering and Flow with junction", () => {
    const rels = allowedRelationships("Junction", "ApplicationFunction");
    expect(rels).toContain("Triggering");
    expect(rels).toContain("Flow");
  });

  it("returns only allowed types as a subset of all types", () => {
    const all = new Set(ARCHIMATE_RELATIONSHIP_TYPES);
    const rels = allowedRelationships("ApplicationComponent", "DataObject");
    for (const r of rels) expect(all.has(r)).toBe(true);
  });

  it("strategy to strategy includes Realization", () => {
    const rels = allowedRelationships("Resource", "Capability");
    expect(rels).toContain("Realization");
  });

  it("strategy to behavior includes Realization", () => {
    const rels = allowedRelationships("Resource", "BusinessProcess");
    expect(rels).toContain("Realization");
  });
});

describe("isRelationshipAllowed", () => {
  it("returns true for Association between any elements", () => {
    expect(isRelationshipAllowed("Association", "ApplicationComponent", "DataObject")).toBe(true);
  });

  it("returns true for Composition between structural elements", () => {
    expect(isRelationshipAllowed("Composition", "ApplicationComponent", "DataObject")).toBe(true);
  });

  it("returns false for Triggering between non-behavior elements", () => {
    expect(isRelationshipAllowed("Triggering", "DataObject", "BusinessObject")).toBe(false);
  });

  it("returns true when no src/tgt (all types allowed)", () => {
    expect(isRelationshipAllowed("Flow")).toBe(true);
  });
});
