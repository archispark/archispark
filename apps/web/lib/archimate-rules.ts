export const ARCHIMATE_RELATIONSHIP_TYPES = [
  "Association",
  "Composition",
  "Aggregation",
  "Assignment",
  "Realization",
  "Serving",
  "Triggering",
  "Flow",
  "Access",
  "Influence",
  "Specialization",
] as const;

export type ArchiCategory =
  | "active"
  | "behavior"
  | "passive"
  | "motivation"
  | "strategy"
  | "implementation"
  | "composite"
  | "junction"
  | "other";

export const ARCHIMATE_CATEGORY: Record<string, ArchiCategory> = {
  BusinessActor: "active", BusinessRole: "active", BusinessCollaboration: "active", BusinessInterface: "active",
  ApplicationComponent: "active", ApplicationCollaboration: "active", ApplicationInterface: "active",
  Node: "active", Device: "active", SystemSoftware: "active", TechnologyCollaboration: "active",
  TechnologyInterface: "active", Path: "active", CommunicationNetwork: "active",
  Equipment: "active", Facility: "active", DistributionNetwork: "active",
  BusinessProcess: "behavior", BusinessFunction: "behavior", BusinessInteraction: "behavior",
  BusinessEvent: "behavior", BusinessService: "behavior",
  ApplicationFunction: "behavior", ApplicationInteraction: "behavior", ApplicationProcess: "behavior",
  ApplicationEvent: "behavior", ApplicationService: "behavior",
  TechnologyFunction: "behavior", TechnologyProcess: "behavior", TechnologyInteraction: "behavior",
  TechnologyEvent: "behavior", TechnologyService: "behavior",
  BusinessObject: "passive", Contract: "passive", Representation: "passive", Product: "passive",
  DataObject: "passive", Artifact: "passive", Material: "passive",
  Stakeholder: "motivation", Driver: "motivation", Assessment: "motivation", Goal: "motivation",
  Outcome: "motivation", Principle: "motivation", Requirement: "motivation",
  Constraint: "motivation", Meaning: "motivation", Value: "motivation",
  Resource: "strategy", Capability: "strategy", ValueStream: "strategy", CourseOfAction: "strategy",
  WorkPackage: "implementation", Deliverable: "implementation",
  ImplementationEvent: "implementation", Plateau: "implementation", Gap: "implementation",
  Grouping: "composite", Location: "composite",
  Junction: "junction", AndJunction: "junction", OrJunction: "junction",
};

export function categoryOf(type?: string): ArchiCategory {
  return type ? (ARCHIMATE_CATEGORY[type] ?? "other") : "other";
}

const STRUCTURAL: ArchiCategory[] = ["active", "passive", "composite", "strategy", "implementation", "behavior"];

export function allowedRelationships(srcType?: string, tgtType?: string): string[] {
  if (!srcType || !tgtType) return [...ARCHIMATE_RELATIONSHIP_TYPES];
  const s = categoryOf(srcType);
  const t = categoryOf(tgtType);
  const allowed = new Set<string>(["Association"]);

  if (srcType === tgtType) allowed.add("Specialization");

  if (STRUCTURAL.includes(s) && STRUCTURAL.includes(t)) {
    allowed.add("Composition");
    allowed.add("Aggregation");
  }

  if (s === "active" && (t === "behavior" || t === "passive" || t === "active")) {
    allowed.add("Assignment");
  }
  if (s === "behavior" && t === "passive") allowed.add("Assignment");

  if (s === "behavior" && (t === "behavior" || t === "passive")) allowed.add("Realization");
  if (s === "active" && t === "behavior") allowed.add("Realization");
  if (s === "implementation") allowed.add("Realization");
  if (s === "strategy" && (t === "strategy" || t === "motivation" || t === "behavior")) allowed.add("Realization");
  if (t === "motivation") allowed.add("Realization");

  if ((s === "behavior" || s === "active") && (t === "active" || t === "behavior")) {
    allowed.add("Serving");
  }

  if (s === "behavior" && t === "behavior") {
    allowed.add("Triggering");
    allowed.add("Flow");
  }
  if (s === "active" && t === "active") allowed.add("Flow");

  if ((s === "behavior" && t === "passive") || (s === "passive" && t === "behavior")) {
    allowed.add("Access");
  }

  if (s === "motivation" || t === "motivation") allowed.add("Influence");

  if (s === "junction" || t === "junction") {
    allowed.add("Triggering");
    allowed.add("Flow");
  }

  return ARCHIMATE_RELATIONSHIP_TYPES.filter((t) => allowed.has(t));
}

export function isRelationshipAllowed(type: string, srcType?: string, tgtType?: string): boolean {
  return allowedRelationships(srcType, tgtType).includes(type);
}
