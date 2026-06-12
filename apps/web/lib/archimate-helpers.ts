// ---------------------------------------------------------------------------
// ArchiMate layer utilities — single source of truth for the web app
// ---------------------------------------------------------------------------

export function getLayer(type: string): string {
  if (type.startsWith("Business") || ["Contract", "Representation", "Product"].includes(type))
    return "Business";
  if (type.startsWith("Application") || type === "DataObject") return "Application";
  if (
    type.startsWith("Technology") ||
    ["Node", "Device", "SystemSoftware", "Path", "CommunicationNetwork", "Artifact"].includes(type)
  )
    return "Technology";
  if (["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)) return "Physical";
  if (
    ["Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle", "Requirement", "Constraint", "Meaning", "Value"].includes(type)
  )
    return "Motivation";
  if (["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)) return "Strategy";
  if (["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"].includes(type))
    return "Implementation";
  return "Composite";
}

/** Tailwind badge classes per layer (for table cells / badges). */
export const LAYER_BADGE_COLORS: Record<string, string> = {
  Business: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Application: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Technology: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Physical: "bg-green-200 text-green-900 dark:bg-green-800/40 dark:text-green-200",
  Motivation: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Strategy: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Implementation: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Composite: "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300",
};

/** Hex color per layer (for charts / canvas). */
export const LAYER_HEX_COLORS: Record<string, string> = {
  Business: "#d97706",
  Application: "#2563eb",
  Technology: "#16a34a",
  Motivation: "#7c3aed",
  Strategy: "#dc2626",
  Physical: "#059669",
  Implementation: "#ea580c",
  Composite: "#64748b",
};

export const LAYER_LABELS: Record<string, string> = {
  Strategy: "Stratégie",
  Business: "Métier",
  Application: "Application",
  Technology: "Technologie",
  Motivation: "Motivation",
  Physical: "Physique",
  Implementation: "Implémentation",
  Composite: "Composite",
};

/**
 * Full ArchiMate 3.1 element-type catalogue (mirrors `ELEMENT_TYPES` in
 * apps/tenant-api/src/schemas.ts — the API's validation source of truth). Used to
 * populate the "new element" type picker, which must offer every type even in
 * an empty workspace — unlike `/elements/types`, which only returns the types
 * already present in the model. Junctions are connectors, not palette elements,
 * so they are intentionally excluded.
 */
export const ALL_ELEMENT_TYPES: readonly string[] = [
  // Business
  "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
  "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
  "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
  // Application
  "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
  "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
  "ApplicationEvent", "ApplicationService", "DataObject",
  // Technology
  "Node", "Device", "SystemSoftware", "TechnologyCollaboration", "TechnologyInterface",
  "Path", "CommunicationNetwork", "TechnologyFunction", "TechnologyProcess",
  "TechnologyInteraction", "TechnologyEvent", "TechnologyService", "Artifact",
  // Physical
  "Equipment", "Facility", "DistributionNetwork", "Material",
  // Motivation
  "Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle",
  "Requirement", "Constraint", "Meaning", "Value",
  // Strategy
  "Resource", "Capability", "CourseOfAction", "ValueStream",
  // Implementation & Migration
  "WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap",
  // Composite
  "Grouping", "Location",
];
