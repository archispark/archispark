/**
 * MCP server.
 *
 * Exposes ArchiMate MCP tools via streamable-HTTP transport.
 * Reads from (and writes to) the same PostgreSQL database as the REST API.
 * Authentication: Bearer token from api_tokens table (same tokens as the REST API).
 * Every tool operates on the authenticated user's own workspaces.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import packageJson from "api/package.json" with { type: "json" };
// Import from the `api` package root (its `.` export), not deep
// `api/src/*.js` paths: the `.` export is traced into `dist/` by
// Vercel's bundler, the wildcard `./src/*.js` export is not (caused
// ERR_MODULE_NOT_FOUND on the deployed lambda).
import {
  getActiveWorkspaceId,
  getWorkspaces,
  activateWorkspace,
  store,
  renderViewToSvg,
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  PROPERTY_DEFINITION_TYPES,
  VIEWPOINTS,
  type ElementUpdateIn,
  type RelationshipUpdateIn,
  type PropertyDefinitionUpdateIn,
  type ViewUpdateIn,
  type NodeUpdateIn,
  type ConnectionCreateIn,
  type ConnectionUpdateIn,
} from "api";
// Auth helpers in a local wrapper so tests can mock them with a simple relative path
// (mocking api sub-modules via wildcard package exports is unreliable in Vitest).
import { lookupApiToken, type TokenUser } from "./token-auth.js";

import {
  ELEMENT_TYPES_BY_LAYER,
  RELATIONSHIP_SEMANTICS,
  LAYERS_RESOURCE_TEXT,
  RELATIONSHIPS_RESOURCE_TEXT,
  MODELING_GUIDE_PROMPT,
  VIEWPOINT_GUIDE_PROMPT_PREFIX,
  elementTypeError,
  relationshipTypeError,
  elementCreationHints,
  relationshipCreationHints,
} from "./archimate-guide.js";


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _PROPERTY_DEFINITION_TYPES_STR = [...PROPERTY_DEFINITION_TYPES].sort((a, b) => a.localeCompare(b)).join(", ");
const _VIEWPOINTS_STR = [...VIEWPOINTS].sort((a, b) => a.localeCompare(b)).join(", ");
const _EDGE_SIDES_STR = "top, right, bottom, left";

function toContent(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

// ---------------------------------------------------------------------------
// MCP server instance
// ---------------------------------------------------------------------------

const { version } = packageJson;

// Build a fresh MCP server (with all tools registered) per HTTP session. A single
// McpServer can only be connected to one transport at a time, so sharing one
// instance across sessions throws "Already connected to a transport" — which on
// serverless means every request after the first on a warm instance 500s.
function createMcpServer(user: TokenUser): McpServer {
  const mcpServer = new McpServer({
    name: "ArchiSpark",
    version,
    description:
      "Serveur de modélisation ArchiMate 3.1 (spec The Open Group). " +
      "Gère des modèles d'architecture d'entreprise structurés en couches " +
      "(Motivation, Strategy, Business, Application, Technology, Physical, Implementation). " +
      "Tous les types d'éléments et de relations sont validés contre la taxonomie ArchiMate 3.1. " +
      "Avant de modéliser, utiliser le prompt 'archimate-modeling-guide' pour charger " +
      "les règles de modélisation et le workflow recommandé.",
  });

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

mcpServer.registerPrompt(
  "archimate-modeling-guide",
  {
    title: "Guide de modélisation ArchiMate 3.1",
    description:
      "Injecte les règles ArchiMate 3.1 complètes: couches, types d'éléments, " +
      "sémantique des relations et workflow de modélisation recommandé. " +
      "À appeler au début de toute session de modélisation.",
  },
  async () => ({
    messages: [{ role: "user" as const, content: { type: "text" as const, text: MODELING_GUIDE_PROMPT } }],
  })
);

mcpServer.registerPrompt(
  "create-viewpoint-view",
  {
    title: "Créer une vue pour un viewpoint donné",
    description:
      "Guide pas-à-pas pour créer une vue ArchiMate adaptée à un viewpoint spécifique " +
      "(Organization, Application Structure, Technology, Layered, etc.).",
    argsSchema: {
      viewpoint: z.string().describe(`Viewpoint ArchiMate cible. Valides: ${_VIEWPOINTS_STR}`),
    },
  },
  async ({ viewpoint }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `${VIEWPOINT_GUIDE_PROMPT_PREFIX}\nViewpoint demandé: **${viewpoint}**\n\nCommence par appeler create_view avec viewpoint="${viewpoint}".`,
      },
    }],
  })
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

mcpServer.registerResource(
  "archimate-layers",
  "archimate://layers",
  {
    title: "Couches et types d'éléments ArchiMate 3.1",
    description:
      "Structure complète des couches ArchiMate 3.1 avec les types d'éléments groupés " +
      "par couche et par catégorie (actifs, comportementaux, passifs). " +
      "Consulter avant create_element pour choisir le bon type.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [{
      uri: "archimate://layers",
      text: LAYERS_RESOURCE_TEXT,
      mimeType: "application/json",
    }],
  })
);

mcpServer.registerResource(
  "archimate-relationships",
  "archimate://relationships",
  {
    title: "Guide des relations ArchiMate 3.1",
    description:
      "Sémantique, direction et exemples de chaque type de relation ArchiMate 3.1. " +
      "Consulter avant create_relationship pour choisir le type le plus précis.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [{
      uri: "archimate://relationships",
      text: RELATIONSHIPS_RESOURCE_TEXT,
      mimeType: "application/json",
    }],
  })
);

// ---------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "get_model_info",
  {
    description:
      "Retourne les métadonnées du workspace actif: identifiant, nom, version, " +
      "et compteurs d'éléments/relations/vues. " +
      "Appeler en premier pour vérifier quel modèle est chargé avant de modéliser.",
    inputSchema: {},
  },
  async () => toContent(await store.getModelInfo(await getActiveWorkspaceId(user.id)))
);

mcpServer.registerTool(
  "list_element_types",
  {
    description:
      "Retourne les types d'éléments ArchiMate 3.1 présents dans le modèle, " +
      "groupés par couche (Business, Application, Technology, Physical, Motivation, " +
      "Strategy, Implementation, Composite) et par catégorie (actifs, comportementaux, passifs). " +
      "Consulter avant create_element pour choisir le bon type.",
    inputSchema: {},
  },
  async () => {
    const presentTypes = await store.listElementTypes(await getActiveWorkspaceId(user.id));
    const presentSet = new Set(presentTypes);

    const grouped: Record<string, unknown> = {};
    for (const [layer, data] of Object.entries(ELEMENT_TYPES_BY_LAYER)) {
      const layerResult: Record<string, unknown> = { description: (data as { description: string }).description };
      if ("elements" in data) {
        layerResult["elements"] = (data.elements as readonly string[]).filter((t) => presentSet.has(t));
        layerResult["all_types"] = data.elements;
      } else {
        const d = data as { active?: readonly string[]; behavioral?: readonly string[]; passive?: readonly string[] };
        if (d.active) layerResult["active"] = d.active.filter((t) => presentSet.has(t));
        if (d.behavioral) layerResult["behavioral"] = d.behavioral.filter((t) => presentSet.has(t));
        if (d.passive) layerResult["passive"] = d.passive.filter((t) => presentSet.has(t));
        if (d.active) layerResult["all_active"] = d.active;
        if (d.behavioral) layerResult["all_behavioral"] = d.behavioral;
        if (d.passive) layerResult["all_passive"] = d.passive;
      }
      grouped[layer] = layerResult;
    }
    return toContent({ layers: grouped, note: "Les listes sans préfixe 'all_' ne contiennent que les types présents dans ce modèle." });
  }
);

mcpServer.registerTool(
  "list_elements",
  {
    description:
      "Liste les éléments du modèle avec filtres optionnels. " +
      "Utiliser element_type pour filtrer par couche (ex: BusinessProcess, ApplicationComponent). " +
      "Utiliser name pour une recherche insensible à la casse. " +
      "Appeler list_element_types pour voir les types disponibles groupés par couche.",
    inputSchema: {
      element_type: z.string().optional().describe("Type ArchiMate 3.1 (ex: ApplicationComponent, BusinessActor)"),
      name: z.string().optional().describe("Filtre par nom (insensible à la casse, sous-chaîne)"),
    },
  },
  async ({ element_type, name }) => {
    if (element_type && !ELEMENT_TYPES.has(element_type)) {
      throw new Error(elementTypeError(element_type));
    }
    return toContent(await store.listElements(await getActiveWorkspaceId(user.id), element_type, name));
  }
);

mcpServer.registerTool(
  "get_element",
  {
    description:
      "Retourne le détail complet d'un élément ArchiMate par son identifiant: " +
      "type, nom, documentation et propriétés personnalisées. " +
      "L'identifiant est le champ 'identifier' retourné par list_elements ou create_element.",
    inputSchema: { element_id: z.string().describe("Identifiant de l'élément (champ 'identifier')") },
  },
  async ({ element_id }) => toContent(await store.getElementById(await getActiveWorkspaceId(user.id), element_id))
);

mcpServer.registerTool(
  "list_relationship_types",
  {
    description:
      "Retourne les types de relations ArchiMate 3.1 présents dans le modèle. " +
      "Pour la sémantique détaillée de chaque type, consulter la ressource archimate://relationships.",
    inputSchema: {},
  },
  async () => {
    const types = await store.listRelationshipTypes(await getActiveWorkspaceId(user.id));
    const withSemantics = types.map((t: string) => ({
      type: t,
      description: RELATIONSHIP_SEMANTICS[t]?.description ?? "",
      direction: RELATIONSHIP_SEMANTICS[t]?.direction ?? "",
    }));
    return toContent(withSemantics);
  }
);

mcpServer.registerTool(
  "list_relationships",
  {
    description:
      "Liste les relations du modèle avec filtres optionnels. " +
      "rel_type filtre par type de relation ArchiMate 3.1. " +
      "source_id_filter et target_id filtrent par identifiant d'élément source ou cible.",
    inputSchema: {
      rel_type: z.string().optional().describe("Type de relation ArchiMate 3.1 (ex: Assignment, Realization, Serving)"),
      source_id_filter: z.string().optional().describe("Filtrer par identifiant d'élément source"),
      target_id: z.string().optional().describe("Filtrer par identifiant d'élément cible"),
    },
  },
  async ({ rel_type, source_id_filter, target_id }) => {
    if (rel_type && !RELATIONSHIP_TYPES.has(rel_type)) {
      throw new Error(relationshipTypeError(rel_type));
    }
    return toContent(await store.listRelationships(await getActiveWorkspaceId(user.id), rel_type, source_id_filter, target_id));
  }
);

mcpServer.registerTool(
  "get_relationship",
  {
    description:
      "Retourne le détail d'une relation ArchiMate par son identifiant: " +
      "type, source, cible, nom et propriétés.",
    inputSchema: { relationship_id: z.string().describe("Identifiant de la relation (champ 'identifier')") },
  },
  async ({ relationship_id }) => {
    return toContent(await store.getRelationshipById(await getActiveWorkspaceId(user.id), relationship_id));
  }
);

mcpServer.registerTool(
  "list_views",
  {
    description:
      "Liste toutes les vues du modèle avec leur viewpoint, nombre de nœuds et de connexions. " +
      "Chaque vue correspond à un diagramme ArchiMate ciblant un public précis.",
    inputSchema: {},
  },
  async () => {
    return toContent(await store.listViews(await getActiveWorkspaceId(user.id)));
  }
);

mcpServer.registerTool(
  "get_view",
  {
    description:
      "Retourne le détail d'une vue ArchiMate: viewpoint, nœuds (éléments placés) " +
      "et connexions (relations représentées). " +
      "Utiliser render_view pour obtenir le SVG visuel.",
    inputSchema: { view_id: z.string().describe("Identifiant de la vue (champ 'identifier')") },
  },
  async ({ view_id }) => {
    return toContent(await store.getViewById(await getActiveWorkspaceId(user.id), view_id));
  }
);

// ---------------------------------------------------------------------------
// Mutation tools – Views & Nodes
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "create_view",
  {
    description:
      "Crée une nouvelle vue (diagramme) ArchiMate dans le modèle. " +
      "Un viewpoint définit le public cible et les types d'éléments attendus. " +
      "Exemples: 'Layered' (vue transversale), 'Application Structure', 'Business Process Cooperation'. " +
      "Après création: utiliser create_node pour placer les éléments, " +
      "create_connection pour les relier visuellement. " +
      "Utiliser le prompt 'create-viewpoint-view' pour un guide pas-à-pas.",
    inputSchema: {
      name: z.string().describe("Nom de la vue"),
      viewpoint: z.string().optional().nullable().describe(`Point de vue ArchiMate. Valides: ${_VIEWPOINTS_STR}`),
      documentation: z.string().optional().nullable().describe("Documentation de la vue (optionnel)"),
    },
  },
  async ({ name, viewpoint, documentation }) => {
    const view = await store.createView(await getActiveWorkspaceId(user.id), { name, viewpoint, documentation });
    return toContent({
      ...view,
      next_steps: [
        "Appeler list_elements pour trouver les éléments à afficher",
        "Appeler create_node pour chaque élément à placer dans cette vue",
        "Appeler create_connection pour représenter les relations visuellement",
        "Appeler render_view pour visualiser le résultat",
      ],
    });
  }
);

mcpServer.registerTool(
  "create_node",
  {
    description:
      "Place un élément ArchiMate dans une vue en créant un nœud visuel. " +
      "Un même élément peut être représenté dans plusieurs vues indépendamment. " +
      "Les coordonnées (x, y) et dimensions (w, h) sont en pixels; si omises, " +
      "l'élément est placé automatiquement. " +
      "Après avoir placé tous les éléments, utiliser create_connection pour représenter les relations.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      element_id: z.string().describe("Identifiant de l'élément à représenter"),
      x: z.number().optional().nullable().describe("Position X en pixels (optionnel)"),
      y: z.number().optional().nullable().describe("Position Y en pixels (optionnel)"),
      w: z.number().optional().nullable().describe("Largeur en pixels (optionnel, défaut ~120)"),
      h: z.number().optional().nullable().describe("Hauteur en pixels (optionnel, défaut ~55)"),
    },
  },
  async ({ view_id, element_id, x, y, w, h }) => {
    return toContent(await store.createNode(await getActiveWorkspaceId(user.id), view_id, { element_id, x, y, w, h }));
  }
);

mcpServer.registerTool(
  "update_view",
  {
    description:
      "Met à jour le nom, le viewpoint ou la documentation d'une vue ArchiMate. " +
      "Seuls les champs fournis sont modifiés.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      viewpoint: z.string().optional().nullable().describe(`Nouveau viewpoint ArchiMate. Valides: ${_VIEWPOINTS_STR}`),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation (null pour effacer)"),
    },
  },
  async ({ view_id, name, viewpoint, documentation }) => {
    const input: ViewUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (viewpoint !== undefined) input.viewpoint = viewpoint;
    if (documentation !== undefined) input.documentation = documentation;
    return toContent(await store.updateView(await getActiveWorkspaceId(user.id), view_id, input));
  }
);

mcpServer.registerTool(
  "delete_view",
  {
    description:
      "Supprime une vue ArchiMate du modèle. " +
      "Les éléments et relations sous-jacents ne sont PAS supprimés — " +
      "seule la représentation visuelle est effacée.",
    inputSchema: { view_id: z.string().describe("Identifiant de la vue à supprimer") },
  },
  async ({ view_id }) => {
    await store.deleteView(await getActiveWorkspaceId(user.id), view_id);
    return toContent({ deleted: true, identifier: view_id });
  }
);

mcpServer.registerTool(
  "update_node",
  {
    description:
      "Met à jour la position, la taille ou le nom d'affichage d'un nœud dans une vue. " +
      "Le nom affiché sur le nœud remplace le nom de l'élément dans cette vue uniquement.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      node_id: z.string().describe("Identifiant du nœud"),
      x: z.number().optional().nullable().describe("Position X en pixels"),
      y: z.number().optional().nullable().describe("Position Y en pixels"),
      w: z.number().optional().nullable().describe("Largeur en pixels"),
      h: z.number().optional().nullable().describe("Hauteur en pixels"),
      name: z.string().optional().nullable().describe("Nom affiché sur le nœud (remplace le nom de l'élément dans cette vue)"),
    },
  },
  async ({ view_id, node_id, x, y, w, h, name }) => {
    const input: NodeUpdateIn = {};
    if (x !== undefined) input.x = x;
    if (y !== undefined) input.y = y;
    if (w !== undefined) input.w = w;
    if (h !== undefined) input.h = h;
    if (name !== undefined) input.name = name;
    return toContent(await store.updateViewNode(await getActiveWorkspaceId(user.id), view_id, node_id, input));
  }
);

mcpServer.registerTool(
  "delete_node",
  {
    description:
      "Retire un nœud d'une vue ArchiMate. " +
      "L'élément ArchiMate sous-jacent n'est pas supprimé — " +
      "il peut rester visible dans d'autres vues.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      node_id: z.string().describe("Identifiant du nœud à retirer"),
    },
  },
  async ({ view_id, node_id }) => {
    await store.deleteViewNode(await getActiveWorkspaceId(user.id), view_id, node_id);
    return toContent({ deleted: true, identifier: node_id });
  }
);

mcpServer.registerTool(
  "create_connection",
  {
    description:
      "Crée une connexion visuelle entre deux nœuds dans une vue ArchiMate. " +
      "La connexion représente visuellement une relation ArchiMate existante (via relationship_id). " +
      "Sans relationship_id, la connexion est purement visuelle (sans sémantique ArchiMate). " +
      "source_side et target_side précisent sur quel côté du nœud se connecte la flèche.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      source: z.string().describe("Identifiant du nœud source"),
      target: z.string().describe("Identifiant du nœud cible"),
      relationship_id: z.string().optional().nullable().describe("Identifiant de la relation ArchiMate sous-jacente (recommandé pour la sémantique)"),
      name: z.string().optional().nullable().describe("Nom de la connexion (optionnel)"),
      source_side: z.string().optional().nullable().describe(`Côté du nœud source: ${_EDGE_SIDES_STR}`),
      target_side: z.string().optional().nullable().describe(`Côté du nœud cible: ${_EDGE_SIDES_STR}`),
    },
  },
  async ({ view_id, source, target, relationship_id, name, source_side, target_side }) => {
    return toContent(await store.createViewConnection(await getActiveWorkspaceId(user.id), view_id, {
      source, target, relationship_id, name,
      source_side: source_side as ConnectionCreateIn["source_side"],
      target_side: target_side as ConnectionCreateIn["target_side"],
    }));
  }
);

mcpServer.registerTool(
  "update_connection",
  {
    description:
      "Met à jour une connexion dans une vue ArchiMate. " +
      "Seuls les champs fournis sont modifiés.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      connection_id: z.string().describe("Identifiant de la connexion"),
      name: z.string().optional().nullable().describe("Nouveau nom (null pour effacer)"),
      source: z.string().optional().describe("Nouvel identifiant de nœud source"),
      target: z.string().optional().describe("Nouvel identifiant de nœud cible"),
      source_side: z.string().optional().nullable().describe(`Côté du nœud source: ${_EDGE_SIDES_STR}`),
      target_side: z.string().optional().nullable().describe(`Côté du nœud cible: ${_EDGE_SIDES_STR}`),
    },
  },
  async ({ view_id, connection_id, name, source, target, source_side, target_side }) => {
    const input: ConnectionUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (source !== undefined) input.source = source;
    if (target !== undefined) input.target = target;
    if (source_side !== undefined) input.source_side = source_side as ConnectionUpdateIn["source_side"];
    if (target_side !== undefined) input.target_side = target_side as ConnectionUpdateIn["target_side"];
    return toContent(await store.updateViewConnection(await getActiveWorkspaceId(user.id), view_id, connection_id, input));
  }
);

mcpServer.registerTool(
  "delete_connection",
  {
    description:
      "Supprime une connexion visuelle d'une vue ArchiMate. " +
      "La relation ArchiMate sous-jacente n'est pas supprimée.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      connection_id: z.string().describe("Identifiant de la connexion à supprimer"),
    },
  },
  async ({ view_id, connection_id }) => {
    await store.deleteViewConnection(await getActiveWorkspaceId(user.id), view_id, connection_id);
    return toContent({ deleted: true, identifier: connection_id });
  }
);

// ---------------------------------------------------------------------------
// Mutation tools – Elements
// ---------------------------------------------------------------------------

const propertyItemSchema = z.object({
  property_definition_ref: z.string().describe("Référence à la définition de propriété"),
  value: z.string().describe("Valeur de la propriété"),
});

mcpServer.registerTool(
  "create_element",
  {
    description:
      "Crée un élément ArchiMate 3.1 dans le workspace actif. " +
      "Choisir le type selon la couche et la catégorie:\n" +
      "• Éléments ACTIFS (Actor, Role, Component, Node): exécutent les comportements via Assignment\n" +
      "• Éléments COMPORTEMENTAUX (Process, Function, Service): réalisent les capacités, servent les couches supérieures\n" +
      "• Éléments PASSIFS (Object, DataObject, Artifact): accédés via AccessRelationship uniquement\n" +
      "Workflow: create_element → create_relationship → create_view → create_node → create_connection. " +
      "Consulter la ressource archimate://layers pour les types par couche.",
    inputSchema: {
      name: z.string().describe("Nom de l'élément"),
      type: z.string().describe(
        "Type ArchiMate 3.1. Exemples: ApplicationComponent (Application), " +
        "BusinessActor (Business actif), BusinessProcess (Business comportemental), " +
        "Node (Technology actif), DataObject (Application passif)"
      ),
      documentation: z.string().optional().nullable().describe("Documentation ou description de l'élément"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
    },
  },
  async ({ name, type, documentation, properties }) => {
    if (!ELEMENT_TYPES.has(type)) {
      throw new Error(elementTypeError(type));
    }
    const element = await store.createElement(await getActiveWorkspaceId(user.id), { name, type, documentation, properties });
    return toContent({ ...element, hints: elementCreationHints(type) });
  }
);

mcpServer.registerTool(
  "update_element",
  {
    description:
      "Met à jour un élément ArchiMate existant. " +
      "Seuls les champs fournis sont modifiés. " +
      "Changer le type d'un élément peut invalider ses relations existantes — " +
      "vérifier avec get_element_relationships après modification.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type ArchiMate 3.1"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation (null pour effacer)"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés (remplace les existantes)"),
    },
  },
  async ({ element_id, name, type, documentation, properties }) => {
    if (type && !ELEMENT_TYPES.has(type)) {
      throw new Error(elementTypeError(type));
    }
    const input: ElementUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    return toContent(await store.updateElement(await getActiveWorkspaceId(user.id), element_id, input));
  }
);

mcpServer.registerTool(
  "delete_element",
  {
    description:
      "Supprime un élément ArchiMate et toutes ses relations (entrantes et sortantes). " +
      "L'élément est également retiré de toutes les vues. " +
      "Action irréversible.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à supprimer"),
    },
  },
  async ({ element_id }) => {
    await store.deleteElement(await getActiveWorkspaceId(user.id), element_id);
    return toContent({ deleted: true, identifier: element_id });
  }
);

// ---------------------------------------------------------------------------
// Mutation tools – Relationships
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "create_relationship",
  {
    description:
      "Crée une relation ArchiMate 3.1 entre deux éléments existants. " +
      "Choisir le type selon la sémantique:\n" +
      "• Assignment: actif → comportemental (même couche)\n" +
      "• Realization: couche inférieure → couche supérieure (Tech→App→Business)\n" +
      "• Serving: fournisseur → consommateur (ApplicationService→BusinessProcess)\n" +
      "• Access: comportemental → passif — préciser access_type (Read/Write/ReadWrite)\n" +
      "• Composition/Aggregation: tout → partie (structurel, inter-couches autorisé)\n" +
      "• Triggering/Flow: entre comportementaux (séquence ou flux de données)\n" +
      "• Association: en dernier recours uniquement\n" +
      "Consulter la ressource archimate://relationships pour les sémantiques détaillées.",
    inputSchema: {
      type: z.string().describe(
        "Type de relation ArchiMate 3.1: Assignment, Realization, Serving, Access, " +
        "Composition, Aggregation, Influence, Triggering, Flow, Specialization, Association"
      ),
      source: z.string().describe("Identifiant de l'élément source"),
      target: z.string().describe("Identifiant de l'élément cible"),
      name: z.string().optional().nullable().describe("Nom de la relation (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
      access_type: z.string().optional().nullable().describe("Type d'accès (Access uniquement): Access, Read, Write, ReadWrite"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée (Association uniquement)"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence (Influence uniquement, ex: '++', '+', '-')"),
    },
  },
  async ({ type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (!RELATIONSHIP_TYPES.has(type)) {
      throw new Error(relationshipTypeError(type));
    }
    const relationship = await store.createRelationship(await getActiveWorkspaceId(user.id), {
      type, source, target, name, documentation, properties,
      access_type, is_directed, influence_strength,
    });
    return toContent({ ...relationship, hints: relationshipCreationHints(type) });
  }
);

mcpServer.registerTool(
  "update_relationship",
  {
    description:
      "Met à jour une relation ArchiMate existante. " +
      "Seuls les champs fournis sont modifiés.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à modifier"),
      name: z.string().optional().nullable().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de relation ArchiMate 3.1"),
      source: z.string().optional().describe("Nouvel identifiant d'élément source"),
      target: z.string().optional().describe("Nouvel identifiant d'élément cible"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés"),
      access_type: z.string().optional().nullable().describe("Type d'accès (Access uniquement)"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence"),
    },
  },
  async ({ relationship_id, name, type, source, target, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (type && !RELATIONSHIP_TYPES.has(type)) {
      throw new Error(relationshipTypeError(type));
    }
    const input: RelationshipUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (source !== undefined) input.source = source;
    if (target !== undefined) input.target = target;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    if (access_type !== undefined) input.access_type = access_type;
    if (is_directed !== undefined) input.is_directed = is_directed;
    if (influence_strength !== undefined) input.influence_strength = influence_strength;
    return toContent(await store.updateRelationship(await getActiveWorkspaceId(user.id), relationship_id, input));
  }
);

mcpServer.registerTool(
  "delete_relationship",
  {
    description:
      "Supprime une relation ArchiMate du modèle. " +
      "Les connexions visuelles associées dans les vues sont également supprimées.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à supprimer"),
    },
  },
  async ({ relationship_id }) => {
    await store.deleteRelationship(await getActiveWorkspaceId(user.id), relationship_id);
    return toContent({ deleted: true, identifier: relationship_id });
  }
);

mcpServer.registerTool(
  "get_element_relationships",
  {
    description:
      "Retourne toutes les relations (entrantes et sortantes) d'un élément ArchiMate. " +
      "Utile pour vérifier la cohérence sémantique d'un élément avant de le modifier ou supprimer.",
    inputSchema: { element_id: z.string().describe("Identifiant de l'élément") },
  },
  async ({ element_id }) => {
    return toContent(await store.getElementRelationships(await getActiveWorkspaceId(user.id), element_id));
  }
);

mcpServer.registerTool(
  "list_elements_in_views",
  {
    description:
      "Retourne les identifiants des éléments placés dans au moins une vue. " +
      "Utile pour distinguer les éléments modélisés (avec représentation visuelle) " +
      "des éléments orphelins (présents dans le modèle mais sans vue).",
    inputSchema: {},
  },
  async () => toContent(await store.listElementsInViews(await getActiveWorkspaceId(user.id)))
);

// ---------------------------------------------------------------------------
// Tools – Workspaces
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_workspaces",
  {
    description:
      "Liste tous les workspaces disponibles et indique lequel est actif. " +
      "Chaque workspace est un modèle ArchiMate indépendant. " +
      "Utiliser activate_workspace pour changer de contexte.",
    inputSchema: {},
  },
  async () => toContent(await getWorkspaces(user.id))
);

mcpServer.registerTool(
  "activate_workspace",
  {
    description:
      "Active un workspace par son identifiant. " +
      "Toutes les opérations suivantes (éléments, relations, vues) portent sur ce workspace. " +
      "L'identifiant est le champ 'id' retourné par list_workspaces.",
    inputSchema: { workspace_id: z.string().describe("Identifiant numérique du workspace (champ 'id' de list_workspaces)") },
  },
  async ({ workspace_id }) => {
    return toContent(await activateWorkspace(workspace_id, user.id));
  }
);

// ---------------------------------------------------------------------------
// Tools – Import / Export
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "export_model",
  {
    description:
      "Exporte le modèle ArchiMate actif au format Open Exchange XML (standard The Open Group). " +
      "Le XML peut être importé dans d'autres outils ArchiMate (Archi, etc.).",
    inputSchema: {},
  },
  async () => {
    const xml = await store.exportModelToXml(await getActiveWorkspaceId(user.id));
    return { content: [{ type: "text" as const, text: xml }] };
  }
);

mcpServer.registerTool(
  "import_model",
  {
    description:
      "Importe un modèle ArchiMate depuis du XML au format Open Exchange (archimate3_Model.xsd). " +
      "ATTENTION: remplace intégralement le contenu du workspace actif. " +
      "Retourne les métadonnées du modèle importé.",
    inputSchema: { xml: z.string().describe("Contenu XML au format Open Exchange ArchiMate 3.1") },
  },
  async ({ xml }) => {
    return toContent(await store.importModelFromXml(await getActiveWorkspaceId(user.id), xml));
  }
);

// ---------------------------------------------------------------------------
// Tools – Viewpoints
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_viewpoints",
  {
    description:
      "Retourne les viewpoints ArchiMate 3.1 disponibles pour les vues. " +
      "Chaque viewpoint définit un angle de vue pour un public précis. " +
      "Viewpoints clés: Layered (vue transversale), Application Structure, " +
      "Business Process Cooperation, Technology, Implementation and Deployment, " +
      "Motivation, Strategy, Capability Map.",
    inputSchema: {},
  },
  async () => toContent([...VIEWPOINTS].sort((a, b) => a.localeCompare(b)))
);

// ---------------------------------------------------------------------------
// Tools – PropertyDefinitions
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_property_definitions",
  {
    description:
      "Liste toutes les définitions de propriétés du modèle ArchiMate. " +
      "Les propriétés permettent d'ajouter des métadonnées personnalisées aux éléments et relations.",
    inputSchema: {},
  },
  async () => toContent(await store.listPropertyDefinitions(await getActiveWorkspaceId(user.id)))
);

mcpServer.registerTool(
  "get_property_definition",
  {
    description: "Retourne le détail d'une définition de propriété par son identifiant.",
    inputSchema: { id: z.string().describe("Identifiant de la définition de propriété") },
  },
  async ({ id }) => toContent(await store.getPropertyDefinitionById(await getActiveWorkspaceId(user.id), id))
);

mcpServer.registerTool(
  "create_property_definition",
  {
    description: `Crée une définition de propriété personnalisée dans le modèle. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de la propriété"),
      type: z.string().optional().describe("Type de données: string (défaut), boolean, date, number, enumeration"),
    },
  },
  async ({ name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    return toContent(await store.createPropertyDefinition(await getActiveWorkspaceId(user.id), { name, type }));
  }
);

mcpServer.registerTool(
  "update_property_definition",
  {
    description: "Met à jour une définition de propriété existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      id: z.string().describe("Identifiant de la définition à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de données"),
    },
  },
  async ({ id, name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    const input: PropertyDefinitionUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    return toContent(await store.updatePropertyDefinition(await getActiveWorkspaceId(user.id), id, input));
  }
);

mcpServer.registerTool(
  "delete_property_definition",
  {
    description:
      "Supprime une définition de propriété et retire toutes les propriétés associées " +
      "des éléments et relations du modèle.",
    inputSchema: { id: z.string().describe("Identifiant de la définition à supprimer") },
  },
  async ({ id }) => {
    await store.deletePropertyDefinition(await getActiveWorkspaceId(user.id), id);
    return toContent({ deleted: true, identifier: id });
  }
);

// ---------------------------------------------------------------------------
// Tools – Persistence & rendering
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "save_model",
  {
    description: "No-op kept for compatibility: every change is persisted to PostgreSQL immediately.",
    inputSchema: {},
  },
  async () => toContent({ saved: true, path: "postgres" })
);

mcpServer.registerTool(
  "render_view",
  {
    description:
      "Génère une image SVG d'une vue ArchiMate. " +
      "Retourne une image base64 encodée en SVG. " +
      "Appeler après avoir placé les éléments et connexions dans la vue.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue à rendre"),
    },
  },
  async ({ view_id }) => {
    const model = await store.loadModel(await getActiveWorkspaceId(user.id));
    const view = model.views.find((v) => v.uuid === view_id);
    if (!view) throw new Error(`Vue '${view_id}' introuvable.`);
    const svg = renderViewToSvg(view, model);
    return {
      content: [{ type: "image" as const, data: Buffer.from(svg).toString("base64"), mimeType: "image/svg+xml" }],
    };
  }
);

  return mcpServer;
}

// ---------------------------------------------------------------------------
// MCP HTTP transport (stateless streamable-http)
// ---------------------------------------------------------------------------
//
// Each request gets a fresh server + transport with NO session id. This is the
// robust pattern for serverless (Vercel): an in-memory session map can't be
// shared across Lambda instances, so a client's follow-up request could land on
// an instance that never saw its session. A stateless tool server (no
// server->client streaming) doesn't need sessions, so we drop them entirely.

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app: ReturnType<typeof express> = express();

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use(express.json());

// Stateless mode has no long-lived session, so the SSE stream (GET) and session
// teardown (DELETE) are not applicable. Register before the auth middleware so
// these short-circuit cleanly regardless of authentication.
const methodNotAllowed = (_req: Request, res: Response): void => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed: this MCP server is stateless." },
    id: null,
  });
};
app.get("/mcp/", methodNotAllowed);
app.delete("/mcp/", methodNotAllowed);

interface McpRequest extends Request {
  mcpUser?: TokenUser;
}

app.use("/mcp/", async (req: McpRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32000, message: "Token requis." }, id: null });
    return;
  }
  try {
    const user = await lookupApiToken(token);
    if (!user) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32000, message: "Token invalide." }, id: null });
      return;
    }
    req.mcpUser = user;
    next();
  } catch {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32000, message: "Erreur d'authentification." }, id: null });
  }
});

app.post("/mcp/", async (req: McpRequest, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); });
    const mcpServer = createMcpServer(req.mcpUser!);
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});
