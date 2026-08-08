import { describe, expect, it } from "vitest";
import { getLayer } from "./layer.js";

describe("getLayer", () => {
  it.each([
    ["BusinessActor", "Business"],
    ["Contract", "Business"],
    ["Representation", "Business"],
    ["Product", "Business"],
    ["ApplicationComponent", "Application"],
    ["DataObject", "Application"],
    ["Node", "Technology"],
    ["Device", "Technology"],
    ["SystemSoftware", "Technology"],
    ["Path", "Technology"],
    ["CommunicationNetwork", "Technology"],
    ["Artifact", "Technology"],
    ["TechnologyService", "Technology"],
    ["Equipment", "Physical"],
    ["Facility", "Physical"],
    ["DistributionNetwork", "Physical"],
    ["Material", "Physical"],
    ["Stakeholder", "Motivation"],
    ["Driver", "Motivation"],
    ["Assessment", "Motivation"],
    ["Goal", "Motivation"],
    ["Outcome", "Motivation"],
    ["Principle", "Motivation"],
    ["Requirement", "Motivation"],
    ["Constraint", "Motivation"],
    ["Meaning", "Motivation"],
    ["Value", "Motivation"],
    ["Resource", "Strategy"],
    ["Capability", "Strategy"],
    ["CourseOfAction", "Strategy"],
    ["ValueStream", "Strategy"],
    ["WorkPackage", "Implementation"],
    ["Deliverable", "Implementation"],
    ["ImplementationEvent", "Implementation"],
    ["Plateau", "Implementation"],
    ["Gap", "Implementation"],
    ["Grouping", "Composite"],
    ["Junction", "Composite"],
    ["", "Composite"],
  ])("maps %s to the %s layer", (type, layer) => {
    expect(getLayer(type)).toBe(layer);
  });
});
