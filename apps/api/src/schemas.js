/**
 * TypeScript types and ArchiMate 3.1 constants aligned with the Open Exchange Format XSD.
 * Sources: archimate3_Model.xsd, archimate3_View.xsd, archimate3_Diagram.xsd (v3.1).
 */
// ---------------------------------------------------------------------------
// ArchiMate 3.1 type constants (archimate3_Model.xsd)
// ---------------------------------------------------------------------------
export const ELEMENT_TYPES = new Set([
    // Business Layer
    "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
    "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
    "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
    // Application Layer
    "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
    "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
    "ApplicationEvent", "ApplicationService", "DataObject",
    // Technology Layer
    "Node", "Device", "SystemSoftware", "TechnologyCollaboration", "TechnologyInterface",
    "Path", "CommunicationNetwork", "TechnologyFunction", "TechnologyProcess",
    "TechnologyInteraction", "TechnologyEvent", "TechnologyService", "Artifact",
    // Physical Layer
    "Equipment", "Facility", "DistributionNetwork", "Material",
    // Motivation
    "Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle",
    "Requirement", "Constraint", "Meaning", "Value",
    // Strategy
    "Resource", "Capability", "CourseOfAction", "ValueStream",
    // Implementation & Migration
    "WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap",
    // Composites & Junctions
    "Grouping", "Location", "AndJunction", "OrJunction",
]);
export const RELATIONSHIP_TYPES = new Set([
    "Composition", "Aggregation", "Assignment", "Realization", "Serving",
    "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
]);
export const ACCESS_TYPES = new Set([
    "Access", "Read", "Write", "ReadWrite",
]);
export const VIEWPOINTS = new Set([
    "Organization", "Application Platform", "Application Structure",
    "Information Structure", "Technology", "Layered", "Physical",
    "Product", "Application Usage", "Technology Usage",
    "Business Process Cooperation", "Application Cooperation",
    "Service Realization", "Implementation and Deployment",
    "Goal Realization", "Goal Contribution", "Principles",
    "Requirements Realization", "Motivation", "Strategy",
    "Capability Map", "Outcome Realization", "Resource Map", "Value Stream",
    "Project", "Migration", "Implementation and Migration", "Stakeholder",
]);
