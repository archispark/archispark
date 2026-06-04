/**
 * ArchiMate 3.1 semantic guide — structured metadata, error helpers, and hints
 * for the MCP server AI responses.
 */

// ─── Layer structure ──────────────────────────────────────────────────────────

export const ELEMENT_TYPES_BY_LAYER = {
  Business: {
    description: "Couche métier: acteurs, processus, services et objets d'information.",
    active: ["BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface"],
    behavioral: ["BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent", "BusinessService"],
    passive: ["BusinessObject", "Contract", "Representation", "Product"],
  },
  Application: {
    description: "Couche applicative: composants logiciels, services et données.",
    active: ["ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface"],
    behavioral: ["ApplicationProcess", "ApplicationFunction", "ApplicationInteraction", "ApplicationEvent", "ApplicationService"],
    passive: ["DataObject"],
  },
  Technology: {
    description: "Couche technique: infrastructure, réseaux et services systèmes.",
    active: ["Node", "Device", "SystemSoftware", "TechnologyCollaboration", "TechnologyInterface", "Path", "CommunicationNetwork"],
    behavioral: ["TechnologyProcess", "TechnologyFunction", "TechnologyInteraction", "TechnologyEvent", "TechnologyService"],
    passive: ["Artifact"],
  },
  Physical: {
    description: "Couche physique: équipements, installations et matériaux.",
    active: ["Equipment", "Facility", "DistributionNetwork"],
    passive: ["Material"],
  },
  Motivation: {
    description: "Couche motivation: parties prenantes, objectifs et exigences.",
    elements: ["Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle", "Requirement", "Constraint", "Meaning", "Value"],
  },
  Strategy: {
    description: "Couche stratégie: ressources, capacités et orientations.",
    elements: ["Resource", "Capability", "CourseOfAction", "ValueStream"],
  },
  "Implementation & Migration": {
    description: "Couche implémentation: projets de transformation, livrables, jalons.",
    elements: ["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"],
  },
  Composite: {
    description: "Éléments transversaux pouvant regrouper des éléments de n'importe quelle couche.",
    elements: ["Grouping", "Location", "AndJunction", "OrJunction"],
  },
} as const;

// ─── Relationship semantics ───────────────────────────────────────────────────

export const RELATIONSHIP_SEMANTICS: Record<string, { description: string; direction: string; example: string }> = {
  Assignment: {
    description: "Lie un élément actif à l'élément comportemental qu'il exécute.",
    direction: "actif → comportemental (même couche ou couche Physical)",
    example: "BusinessActor → BusinessProcess, ApplicationComponent → ApplicationFunction",
  },
  Realization: {
    description: "Un élément plus concret implémente un élément plus abstrait.",
    direction: "couche inférieure → couche supérieure",
    example: "ApplicationService → BusinessService, TechnologyService → ApplicationService",
  },
  Serving: {
    description: "Un élément fournit des services à un autre (dépendance utilisateur).",
    direction: "fournisseur → consommateur",
    example: "ApplicationService → BusinessProcess, TechnologyService → ApplicationComponent",
  },
  Composition: {
    description: "L'élément source contient les parties cibles (la partie n'existe pas sans le tout).",
    direction: "tout → partie",
    example: "BusinessProcess → BusinessProcess (sous-processus), ApplicationComponent → ApplicationComponent",
  },
  Aggregation: {
    description: "L'élément source regroupe les parties cibles (la partie peut exister indépendamment).",
    direction: "tout → partie",
    example: "BusinessCollaboration → BusinessRole, ApplicationCollaboration → ApplicationComponent",
  },
  Access: {
    description: "Un élément comportemental lit ou écrit un élément passif. Toujours préciser access_type.",
    direction: "comportemental → passif",
    example: "BusinessProcess → BusinessObject (Write), ApplicationFunction → DataObject (ReadWrite)",
  },
  Influence: {
    description: "Un élément influe sur un autre sans relation structurelle (souvent en couche Motivation).",
    direction: "source → cible",
    example: "Driver → Goal, Principle → BusinessProcess",
  },
  Triggering: {
    description: "Un élément comportemental déclenche un autre (causalité forte).",
    direction: "déclencheur → déclenché",
    example: "BusinessEvent → BusinessProcess, ApplicationEvent → ApplicationProcess",
  },
  Flow: {
    description: "Représente un flux d'information ou de matière entre deux éléments comportementaux.",
    direction: "source → destination",
    example: "BusinessProcess → BusinessProcess (passage de données), TechnologyService → TechnologyService",
  },
  Specialization: {
    description: "L'élément source est un sous-type de l'élément cible (même type ou type compatible).",
    direction: "spécialisé → général",
    example: "BusinessRole → BusinessRole (SeniorManager spécialise Manager)",
  },
  Association: {
    description: "Relation non spécifiée. À utiliser en dernier recours quand aucune autre relation ne convient.",
    direction: "bidirectionnel ou dirigé",
    example: "BusinessActor → BusinessObject (relation informelle sans sémantique précise)",
  },
};

// ─── Error helpers ────────────────────────────────────────────────────────────

const LAYER_TYPES_DISPLAY = `\
  • Business    : BusinessActor, BusinessRole, BusinessCollaboration, BusinessInterface, BusinessProcess, BusinessFunction, BusinessInteraction, BusinessEvent, BusinessService, BusinessObject, Contract, Representation, Product
  • Application : ApplicationComponent, ApplicationCollaboration, ApplicationInterface, ApplicationProcess, ApplicationFunction, ApplicationInteraction, ApplicationEvent, ApplicationService, DataObject
  • Technology  : Node, Device, SystemSoftware, TechnologyCollaboration, TechnologyInterface, Path, CommunicationNetwork, TechnologyProcess, TechnologyFunction, TechnologyInteraction, TechnologyEvent, TechnologyService, Artifact
  • Physical    : Equipment, Facility, DistributionNetwork, Material
  • Motivation  : Stakeholder, Driver, Assessment, Goal, Outcome, Principle, Requirement, Constraint, Meaning, Value
  • Strategy    : Resource, Capability, CourseOfAction, ValueStream
  • Impl/Migr   : WorkPackage, Deliverable, ImplementationEvent, Plateau, Gap
  • Composite   : Grouping, Location, AndJunction, OrJunction`;

export function elementTypeError(type: string): string {
  return (
    `Type d'élément invalide: '${type}'.\n\n` +
    `Types valides ArchiMate 3.1, par couche:\n${LAYER_TYPES_DISPLAY}\n\n` +
    `Conseil: appeler list_element_types pour voir les types groupés par couche.`
  );
}

export function relationshipTypeError(type: string): string {
  return (
    `Type de relation invalide: '${type}'.\n\n` +
    `Types valides ArchiMate 3.1:\n` +
    `  • Structurelles : Composition, Aggregation, Assignment, Realization, Specialization\n` +
    `  • Dépendance    : Serving, Access (préciser access_type: Read/Write/ReadWrite), Influence\n` +
    `  • Dynamiques    : Triggering, Flow\n` +
    `  • Générique     : Association (dernier recours)\n\n` +
    `Conseil: consulter la ressource archimate://relationships pour les sémantiques détaillées.`
  );
}

// ─── Post-mutation hints ──────────────────────────────────────────────────────

const LAYER_OF: Record<string, string> = {
  BusinessActor: "Business", BusinessRole: "Business", BusinessCollaboration: "Business",
  BusinessInterface: "Business", BusinessProcess: "Business", BusinessFunction: "Business",
  BusinessInteraction: "Business", BusinessEvent: "Business", BusinessService: "Business",
  BusinessObject: "Business", Contract: "Business", Representation: "Business", Product: "Business",
  ApplicationComponent: "Application", ApplicationCollaboration: "Application",
  ApplicationInterface: "Application", ApplicationProcess: "Application",
  ApplicationFunction: "Application", ApplicationInteraction: "Application",
  ApplicationEvent: "Application", ApplicationService: "Application", DataObject: "Application",
  Node: "Technology", Device: "Technology", SystemSoftware: "Technology",
  TechnologyCollaboration: "Technology", TechnologyInterface: "Technology",
  Path: "Technology", CommunicationNetwork: "Technology",
  TechnologyProcess: "Technology", TechnologyFunction: "Technology",
  TechnologyInteraction: "Technology", TechnologyEvent: "Technology",
  TechnologyService: "Technology", Artifact: "Technology",
  Equipment: "Physical", Facility: "Physical", DistributionNetwork: "Physical", Material: "Physical",
  Stakeholder: "Motivation", Driver: "Motivation", Assessment: "Motivation", Goal: "Motivation",
  Outcome: "Motivation", Principle: "Motivation", Requirement: "Motivation",
  Constraint: "Motivation", Meaning: "Motivation", Value: "Motivation",
  Resource: "Strategy", Capability: "Strategy", CourseOfAction: "Strategy", ValueStream: "Strategy",
  WorkPackage: "Implementation", Deliverable: "Implementation",
  ImplementationEvent: "Implementation", Plateau: "Implementation", Gap: "Implementation",
  Grouping: "Composite", Location: "Composite", AndJunction: "Composite", OrJunction: "Composite",
};

const LAYER_HINTS: Record<string, string[]> = {
  Business: [
    "Relier les éléments actifs (Actor, Role) aux comportementaux (Process, Function) via Assignment",
    "Relier les BusinessService aux ApplicationService qui les réalisent via Realization (App→Business)",
    "Créer une vue: viewpoint 'Organization' pour les acteurs, 'Business Process Cooperation' pour les processus",
  ],
  Application: [
    "Relier les ApplicationService aux BusinessProcess qu'ils servent via Serving",
    "Relier les TechnologyService qui les supportent via Realization (Tech→Application)",
    "Créer une vue: viewpoint 'Application Structure' ou 'Application Usage'",
  ],
  Technology: [
    "Relier les TechnologyService aux ApplicationComponent qu'ils supportent via Realization",
    "Regrouper Node/Device/SystemSoftware via Composition ou Aggregation",
    "Créer une vue: viewpoint 'Technology' ou 'Implementation and Deployment'",
  ],
  Physical: [
    "Relier les Equipment aux Node Technology via Realization",
    "Regrouper dans une Facility via Composition",
    "Créer une vue: viewpoint 'Physical'",
  ],
  Motivation: [
    "Relier les Stakeholder aux Driver/Goal via Association ou Influence",
    "Relier les Requirement aux éléments comportementaux qui les réalisent via Realization",
    "Créer une vue: viewpoint 'Motivation' ou 'Goal Realization'",
  ],
  Strategy: [
    "Relier les Resource aux éléments actifs Technology/Business via Assignment",
    "Relier les Capability aux éléments Business via Realization",
    "Créer une vue: viewpoint 'Strategy' ou 'Capability Map'",
  ],
  Implementation: [
    "Relier les WorkPackage aux Deliverable via Association",
    "Relier les Plateau via Gap pour représenter les états avant/après migration",
    "Créer une vue: viewpoint 'Project' ou 'Implementation and Migration'",
  ],
  Composite: [
    "Grouping et Location peuvent contenir des éléments de toutes les couches",
    "Utiliser create_node pour imbriquer visuellement des éléments dans une vue",
  ],
};

export function elementCreationHints(type: string): { layer: string; next_steps: string[] } {
  const layer = LAYER_OF[type] ?? "Composite";
  return { layer, next_steps: LAYER_HINTS[layer] ?? LAYER_HINTS["Composite"]! };
}

export function relationshipCreationHints(relType: string): { semantics: string; direction: string; next_steps: string[] } {
  const guide = RELATIONSHIP_SEMANTICS[relType];
  return {
    semantics: guide?.description ?? "",
    direction: guide?.direction ?? "",
    next_steps: [
      "Visualiser dans une vue via create_connection (avec le relationship_id retourné)",
      "Vérifier la cohérence avec get_element_relationships sur l'élément source",
    ],
  };
}

// ─── Resource content ─────────────────────────────────────────────────────────

export const LAYERS_RESOURCE_TEXT = JSON.stringify(ELEMENT_TYPES_BY_LAYER, null, 2);
export const RELATIONSHIPS_RESOURCE_TEXT = JSON.stringify(RELATIONSHIP_SEMANTICS, null, 2);

// ─── Prompt content ───────────────────────────────────────────────────────────

export const MODELING_GUIDE_PROMPT = `\
Tu travailles avec un modèle ArchiMate 3.1 (spec The Open Group) via le serveur MCP ArchiSpark.

## Couches et types d'éléments

**Motivation** (pourquoi): Stakeholder, Driver, Assessment, Goal, Outcome, Principle, Requirement, Constraint, Meaning, Value
**Strategy** (orientations): Resource, Capability, CourseOfAction, ValueStream
**Business actifs**: BusinessActor, BusinessRole, BusinessCollaboration, BusinessInterface
**Business comportemental**: BusinessProcess, BusinessFunction, BusinessInteraction, BusinessEvent, BusinessService
**Business passif**: BusinessObject, Contract, Representation, Product
**Application actifs**: ApplicationComponent, ApplicationCollaboration, ApplicationInterface
**Application comportemental**: ApplicationProcess, ApplicationFunction, ApplicationInteraction, ApplicationEvent, ApplicationService
**Application passif**: DataObject
**Technology actifs**: Node, Device, SystemSoftware, TechnologyCollaboration, TechnologyInterface, Path, CommunicationNetwork
**Technology comportemental**: TechnologyProcess, TechnologyFunction, TechnologyInteraction, TechnologyEvent, TechnologyService
**Technology passif**: Artifact
**Physical**: Equipment, Facility, DistributionNetwork, Material
**Implementation & Migration**: WorkPackage, Deliverable, ImplementationEvent, Plateau, Gap
**Composite**: Grouping, Location, AndJunction, OrJunction

## Relations (du plus précis au plus générique)

| Type | Sémantique | Direction |
|---|---|---|
| Assignment | Actif exécute comportemental | actif → comportemental |
| Realization | Concret implémente abstrait | couche inférieure → supérieure |
| Serving | Fournisseur sert consommateur | fournisseur → consommateur |
| Composition | Contient (partie liée au tout) | tout → partie |
| Aggregation | Regroupe (partie indépendante) | tout → partie |
| Access | Comportemental lit/écrit passif | comportemental → passif |
| Influence | Influe sans relation structurelle | source → cible |
| Triggering | Déclenche (causalité forte) | déclencheur → déclenché |
| Flow | Flux de données ou matière | source → destination |
| Specialization | Sous-type d'un élément | spécialisé → général |
| Association | Non spécifié (dernier recours) | bidirectionnel |

## Règles essentielles

1. **Assignment**: actif → comportemental de même couche (BusinessActor→BusinessProcess, ApplicationComponent→ApplicationFunction)
2. **Realization verticale**: Technology réalise Application, Application réalise Business (sens montant)
3. **Serving inter-couche**: ApplicationService→BusinessProcess, TechnologyService→ApplicationComponent
4. **Objets passifs**: accédés via Access uniquement — jamais assignés ni triggering
5. **Préférer le type précis**: Assignment/Realization/Serving avant Association

## Workflow recommandé

1. \`get_model_info\` — vérifier le workspace actif
2. \`create_element\` × N — créer tous les éléments
3. \`create_relationship\` × N — relier les éléments
4. \`create_view\` avec viewpoint — créer la vue adaptée au public
5. \`create_node\` × N — placer les éléments dans la vue
6. \`create_connection\` × N — représenter visuellement les relations
7. \`render_view\` — visualiser le résultat SVG
`;

export const VIEWPOINT_GUIDE_PROMPT_PREFIX = `\
Tu vas créer une vue ArchiMate 3.1 avec le viewpoint demandé.

## Guide des viewpoints principaux

| Viewpoint | Public | Éléments typiques |
|---|---|---|
| Organization | Direction, RH | BusinessActor, BusinessRole, BusinessCollaboration |
| Business Process Cooperation | Architectes métier | BusinessProcess, BusinessService, BusinessEvent |
| Application Structure | Architectes applicatifs | ApplicationComponent, ApplicationInterface, DataObject |
| Application Usage | Architectes applicatifs | ApplicationComponent, ApplicationService, BusinessProcess |
| Application Platform | Architectes tech | ApplicationComponent, Node, TechnologyService |
| Technology | Architectes infrastructure | Node, Device, SystemSoftware, CommunicationNetwork |
| Implementation and Deployment | Architectes tech | ApplicationComponent, Node, Artifact |
| Layered | Toutes parties prenantes | Tous types, vue transversale |
| Motivation | Direction, Sponsors | Stakeholder, Driver, Goal, Requirement |
| Strategy | Direction | Capability, Resource, CourseOfAction |
| Capability Map | Direction | Capability |
| Project | Chefs de projet | WorkPackage, Deliverable, Plateau |
| Physical | Architectes physiques | Equipment, Facility, Node |

## Étapes

1. \`create_view\` avec le viewpoint choisi
2. \`list_elements\` pour trouver les éléments pertinents
3. \`create_node\` pour chaque élément à afficher
4. \`list_relationships\` pour les relations entre ces éléments
5. \`create_connection\` pour chaque relation à représenter
6. \`render_view\` pour visualiser
`;
