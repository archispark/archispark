/**
 * ArchiMate layer for an element type, mirroring
 * `apps/server/lib/archimate-helpers.ts`'s `getLayer` — duplicated rather than
 * imported so this package doesn't depend on `apps/server` (see
 * docs/architecture.md#neo4j-export). Stored as `Element.layer` in Neo4j so
 * reporting Cypher queries can filter by layer without recomputing it from
 * `type` on every read.
 */
export function getLayer(type: string): string {
  if (
    type.startsWith("Business") ||
    ["Contract", "Representation", "Product"].includes(type)
  )
    return "Business";
  if (type.startsWith("Application") || type === "DataObject")
    return "Application";
  if (
    type.startsWith("Technology") ||
    [
      "Node",
      "Device",
      "SystemSoftware",
      "Path",
      "CommunicationNetwork",
      "Artifact",
    ].includes(type)
  )
    return "Technology";
  if (
    ["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)
  )
    return "Physical";
  if (
    [
      "Stakeholder",
      "Driver",
      "Assessment",
      "Goal",
      "Outcome",
      "Principle",
      "Requirement",
      "Constraint",
      "Meaning",
      "Value",
    ].includes(type)
  )
    return "Motivation";
  if (
    ["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)
  )
    return "Strategy";
  if (
    [
      "WorkPackage",
      "Deliverable",
      "ImplementationEvent",
      "Plateau",
      "Gap",
    ].includes(type)
  )
    return "Implementation";
  return "Composite";
}
