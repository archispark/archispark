export const ARCHIMATE_LAYER: Record<string, string> = {
  Resource: "strategy",
  Capability: "strategy",
  ValueStream: "strategy",
  CourseOfAction: "strategy",
  BusinessActor: "business",
  BusinessRole: "business",
  BusinessCollaboration: "business",
  BusinessInterface: "business",
  BusinessProcess: "business",
  BusinessFunction: "business",
  BusinessInteraction: "business",
  BusinessEvent: "business",
  BusinessService: "business",
  BusinessObject: "business",
  Contract: "business",
  Representation: "business",
  Product: "business",
  ApplicationComponent: "application",
  ApplicationCollaboration: "application",
  ApplicationInterface: "application",
  ApplicationFunction: "application",
  ApplicationInteraction: "application",
  ApplicationProcess: "application",
  ApplicationEvent: "application",
  ApplicationService: "application",
  DataObject: "application",
  Node: "technology",
  Device: "technology",
  SystemSoftware: "technology",
  TechnologyCollaboration: "technology",
  TechnologyInterface: "technology",
  Path: "technology",
  CommunicationNetwork: "technology",
  TechnologyFunction: "technology",
  TechnologyProcess: "technology",
  TechnologyInteraction: "technology",
  TechnologyEvent: "technology",
  TechnologyService: "technology",
  Artifact: "technology",
  Equipment: "physical",
  Facility: "physical",
  DistributionNetwork: "physical",
  Material: "physical",
  Stakeholder: "motivation",
  Driver: "motivation",
  Assessment: "motivation",
  Goal: "motivation",
  Outcome: "motivation",
  Principle: "motivation",
  Requirement: "motivation",
  Constraint: "motivation",
  Meaning: "motivation",
  Value: "motivation",
  WorkPackage: "implementation",
  Deliverable: "implementation",
  ImplementationEvent: "implementation",
  Plateau: "implementation",
  Gap: "implementation",
  Grouping: "other",
  Location: "other",
  Junction: "junction",
  AndJunction: "junction",
  OrJunction: "junction",
}

// Colors aligned with sidebar LAYER_GROUPS dots
export const LAYER_COLOR: Record<string, { bg: string; border: string }> = {
  strategy: { bg: "#fee2e2", border: "#dc2626" }, // red-100 / red-600
  business: { bg: "#fef3c7", border: "#d97706" }, // amber-100 / amber-600
  application: { bg: "#dbeafe", border: "#2563eb" }, // blue-100 / blue-600
  technology: { bg: "#dcfce7", border: "#16a34a" }, // green-100 / green-600
  physical: { bg: "#d1fae5", border: "#059669" }, // emerald-100 / emerald-600
  motivation: { bg: "#ede9fe", border: "#7c3aed" }, // violet-100 / violet-700
  implementation: { bg: "#ffedd5", border: "#ea580c" }, // orange-100 / orange-600
  other: { bg: "#f1f5f9", border: "#64748b" }, // slate-100 / slate-500
  junction: { bg: "#000000", border: "#000000" },
}

export function colorFor(elementType?: string): { bg: string; border: string } {
  const layer = elementType ? ARCHIMATE_LAYER[elementType] : undefined
  return LAYER_COLOR[layer ?? "other"] ?? LAYER_COLOR["other"]!
}
