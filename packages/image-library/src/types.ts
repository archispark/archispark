/**
 * Shared types for the ArchiSpark image library. Consumed by apps/server
 * (metadata for the image picker) and apps/docs (the ArchiMate icon
 * gallery), so this package must stay free of any server-only dependency
 * (no DB, no Node-only API).
 */

export interface SystemArchimateIcon {
  slug: string
  name: string
  archimateType: string
  /** Self-contained SVG markup, viewBox 0 0 32 32, stroke="currentColor". */
  svg: string
}

/**
 * ArchiMate layer for a given element type — duplicated from
 * apps/server/lib/archimate-helpers.ts (that file is the source of truth for
 * the web app; apps/docs cannot import across apps, so the icon gallery uses
 * this copy to group icons by layer).
 */
export function layerForArchimateType(type: string): string {
  if (
    type.startsWith("Business") ||
    ["Contract", "Representation", "Product"].includes(type)
  )
    return "Business"
  if (type.startsWith("Application") || type === "DataObject")
    return "Application"
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
    return "Technology"
  if (
    ["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)
  )
    return "Physical"
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
    return "Motivation"
  if (
    ["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)
  )
    return "Strategy"
  if (
    ["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"].includes(
      type
    )
  )
    return "Implementation"
  return "Composite"
}
