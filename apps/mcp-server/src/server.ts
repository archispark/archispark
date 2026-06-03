/**
 * MCP server.
 *
 * Exposes ArchiMate MCP tools via streamable-HTTP transport.
 * Reads from (and writes to) the same PostgreSQL database as the REST API.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import packageJson from "api/package.json" with { type: "json" };
// Import from the `api` package root (its `.` export), not deep `api/src/*.js`
// paths: the `.` export is traced into `dist/` by Vercel's bundler, the wildcard
// `./src/*.js` export is not (caused ERR_MODULE_NOT_FOUND on the deployed lambda).
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


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _ELEMENT_TYPES_STR = [...ELEMENT_TYPES].sort().join(", ");
const _RELATIONSHIP_TYPES_STR = [...RELATIONSHIP_TYPES].sort().join(", ");
const _PROPERTY_DEFINITION_TYPES_STR = [...PROPERTY_DEFINITION_TYPES].sort().join(", ");
const _VIEWPOINTS_STR = [...VIEWPOINTS].sort().join(", ");
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
function createMcpServer(): McpServer {
  const mcpServer = new McpServer({ name: "ArchiMate MCP", version });

// ---------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "get_model_info",
  { description: "Retourne les métadonnées globales du modèle ArchiMate chargé (identifiant, nom, version, compteurs).", inputSchema: {} },
  async () => toContent(await store.getModelInfo(await getActiveWorkspaceId()))
);

mcpServer.registerTool(
  "list_element_types",
  { description: "Retourne la liste triée des types d'éléments ArchiMate 3.1 présents dans le modèle.", inputSchema: {} },
  async () => toContent(await store.listElementTypes(await getActiveWorkspaceId()))
);

mcpServer.registerTool(
  "list_elements",
  {
    description: `Liste les éléments du modèle avec filtres optionnels. element_type doit être un type ArchiMate 3.1 valide parmi: ${_ELEMENT_TYPES_STR}.`,
    inputSchema: {
      element_type: z.string().optional().describe("Type ArchiMate 3.1 (ex: ApplicationComponent)"),
      name: z.string().optional().describe("Filtre par nom (insensible à la casse, sous-chaîne)"),
    },
  },
  async ({ element_type, name }) => {
    if (element_type && !ELEMENT_TYPES.has(element_type)) {
      throw new Error(`Type d'élément invalide: '${element_type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(await store.listElements(await getActiveWorkspaceId(), element_type, name));
  }
);

mcpServer.registerTool(
  "get_element",
  { description: "Retourne le détail d'un élément ArchiMate par son identifiant (champ 'identifier').", inputSchema: { element_id: z.string().describe("Identifiant de l'élément") } },
  async ({ element_id }) => toContent(await store.getElementById(await getActiveWorkspaceId(), element_id))
);

mcpServer.registerTool(
  "list_relationship_types",
  { description: "Retourne la liste triée des types de relations ArchiMate 3.1 présents dans le modèle.", inputSchema: {} },
  async () => toContent(await store.listRelationshipTypes(await getActiveWorkspaceId()))
);

mcpServer.registerTool(
  "list_relationships",
  {
    description: `Liste les relations du modèle avec filtres optionnels. rel_type doit être parmi: ${_RELATIONSHIP_TYPES_STR}.`,
    inputSchema: {
      rel_type: z.string().optional().describe("Type de relation ArchiMate 3.1"),
      source_id_filter: z.string().optional().describe("Filtrer par identifiant source"),
      target_id: z.string().optional().describe("Filtrer par identifiant cible"),
    },
  },
  async ({ rel_type, source_id_filter, target_id }) => {
    if (rel_type && !RELATIONSHIP_TYPES.has(rel_type)) {
      throw new Error(`Type de relation invalide: '${rel_type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(await store.listRelationships(await getActiveWorkspaceId(), rel_type, source_id_filter, target_id));
  }
);

mcpServer.registerTool(
  "get_relationship",
  { description: "Retourne le détail d'une relation ArchiMate par son identifiant.", inputSchema: { relationship_id: z.string().describe("Identifiant de la relation") } },
  async ({ relationship_id }) => toContent(await store.getRelationshipById(await getActiveWorkspaceId(), relationship_id))
);

mcpServer.registerTool(
  "list_views",
  { description: "Liste toutes les vues du modèle avec leur nombre de nœuds et de connexions.", inputSchema: {} },
  async () => toContent(await store.listViews(await getActiveWorkspaceId()))
);

mcpServer.registerTool(
  "get_view",
  { description: "Retourne le détail d'une vue ArchiMate par son identifiant.", inputSchema: { view_id: z.string().describe("Identifiant de la vue") } },
  async ({ view_id }) => toContent(await store.getViewById(await getActiveWorkspaceId(), view_id))
);

// ---------------------------------------------------------------------------
// Mutation tools – Views & Nodes
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "create_view",
  {
    description: "Crée une nouvelle vue (diagramme) dans le modèle ArchiMate.",
    inputSchema: {
      name: z.string().describe("Nom de la vue"),
      viewpoint: z.string().optional().nullable().describe("Point de vue ArchiMate (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation (optionnel)"),
    },
  },
  async ({ name, viewpoint, documentation }) =>
    toContent(await store.createView(await getActiveWorkspaceId(), { name, viewpoint, documentation }))
);

mcpServer.registerTool(
  "create_node",
  {
    description: "Ajoute un nœud (représentation visuelle d'un élément) dans une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      element_id: z.string().describe("Identifiant de l'élément à représenter"),
      x: z.number().optional().nullable().describe("Position X en pixels"),
      y: z.number().optional().nullable().describe("Position Y en pixels"),
      w: z.number().optional().nullable().describe("Largeur en pixels"),
      h: z.number().optional().nullable().describe("Hauteur en pixels"),
    },
  },
  async ({ view_id, element_id, x, y, w, h }) =>
    toContent(await store.createNode(await getActiveWorkspaceId(), view_id, { element_id, x, y, w, h }))
);

mcpServer.registerTool(
  "update_view",
  {
    description: "Met à jour une vue ArchiMate existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      viewpoint: z.string().optional().nullable().describe(`Nouveau point de vue ArchiMate. Valides: ${_VIEWPOINTS_STR}`),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation (null pour effacer)"),
    },
  },
  async ({ view_id, name, viewpoint, documentation }) => {
    const input: ViewUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (viewpoint !== undefined) input.viewpoint = viewpoint;
    if (documentation !== undefined) input.documentation = documentation;
    return toContent(await store.updateView(await getActiveWorkspaceId(), view_id, input));
  }
);

mcpServer.registerTool(
  "delete_view",
  {
    description: "Supprime une vue ArchiMate du modèle (les éléments sous-jacents ne sont pas supprimés).",
    inputSchema: { view_id: z.string().describe("Identifiant de la vue à supprimer") },
  },
  async ({ view_id }) => {
    await store.deleteView(await getActiveWorkspaceId(), view_id);
    return toContent({ deleted: true, identifier: view_id });
  }
);

mcpServer.registerTool(
  "update_node",
  {
    description: "Met à jour la position, la taille ou le nom d'un nœud dans une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      node_id: z.string().describe("Identifiant du nœud"),
      x: z.number().optional().nullable().describe("Position X en pixels"),
      y: z.number().optional().nullable().describe("Position Y en pixels"),
      w: z.number().optional().nullable().describe("Largeur en pixels"),
      h: z.number().optional().nullable().describe("Hauteur en pixels"),
      name: z.string().optional().nullable().describe("Nom affiché sur le nœud (remplace le nom de l'élément)"),
    },
  },
  async ({ view_id, node_id, x, y, w, h, name }) => {
    const input: NodeUpdateIn = {};
    if (x !== undefined) input.x = x;
    if (y !== undefined) input.y = y;
    if (w !== undefined) input.w = w;
    if (h !== undefined) input.h = h;
    if (name !== undefined) input.name = name;
    return toContent(await store.updateViewNode(await getActiveWorkspaceId(), view_id, node_id, input));
  }
);

mcpServer.registerTool(
  "delete_node",
  {
    description: "Retire un nœud (et ses enfants) d'une vue ArchiMate. L'élément sous-jacent n'est pas supprimé.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      node_id: z.string().describe("Identifiant du nœud à retirer"),
    },
  },
  async ({ view_id, node_id }) => {
    await store.deleteViewNode(await getActiveWorkspaceId(), view_id, node_id);
    return toContent({ deleted: true, identifier: node_id });
  }
);

mcpServer.registerTool(
  "create_connection",
  {
    description: "Crée une connexion visuelle entre deux nœuds dans une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      source: z.string().describe("Identifiant du nœud source"),
      target: z.string().describe("Identifiant du nœud cible"),
      relationship_id: z.string().optional().nullable().describe("Identifiant de la relation ArchiMate sous-jacente (optionnel)"),
      name: z.string().optional().nullable().describe("Nom de la connexion (optionnel)"),
      source_side: z.string().optional().nullable().describe(`Côté du nœud source (${_EDGE_SIDES_STR})`),
      target_side: z.string().optional().nullable().describe(`Côté du nœud cible (${_EDGE_SIDES_STR})`),
    },
  },
  async ({ view_id, source, target, relationship_id, name, source_side, target_side }) =>
    toContent(await store.createViewConnection(await getActiveWorkspaceId(), view_id, {
      source, target, relationship_id, name,
      source_side: source_side as ConnectionCreateIn["source_side"],
      target_side: target_side as ConnectionCreateIn["target_side"],
    }))
);

mcpServer.registerTool(
  "update_connection",
  {
    description: "Met à jour une connexion dans une vue ArchiMate. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      connection_id: z.string().describe("Identifiant de la connexion"),
      name: z.string().optional().nullable().describe("Nouveau nom (null pour effacer)"),
      source: z.string().optional().describe("Nouvel identifiant de nœud source"),
      target: z.string().optional().describe("Nouvel identifiant de nœud cible"),
      source_side: z.string().optional().nullable().describe(`Côté du nœud source (${_EDGE_SIDES_STR})`),
      target_side: z.string().optional().nullable().describe(`Côté du nœud cible (${_EDGE_SIDES_STR})`),
    },
  },
  async ({ view_id, connection_id, name, source, target, source_side, target_side }) => {
    const input: ConnectionUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (source !== undefined) input.source = source;
    if (target !== undefined) input.target = target;
    if (source_side !== undefined) input.source_side = source_side as ConnectionUpdateIn["source_side"];
    if (target_side !== undefined) input.target_side = target_side as ConnectionUpdateIn["target_side"];
    return toContent(await store.updateViewConnection(await getActiveWorkspaceId(), view_id, connection_id, input));
  }
);

mcpServer.registerTool(
  "delete_connection",
  {
    description: "Supprime une connexion d'une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      connection_id: z.string().describe("Identifiant de la connexion à supprimer"),
    },
  },
  async ({ view_id, connection_id }) => {
    await store.deleteViewConnection(await getActiveWorkspaceId(), view_id, connection_id);
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
    description: `Crée un nouvel élément ArchiMate dans le modèle (en mémoire). Types valides: ${_ELEMENT_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de l'élément"),
      type: z.string().describe("Type ArchiMate 3.1 (ex: ApplicationComponent, BusinessActor)"),
      documentation: z.string().optional().nullable().describe("Documentation / description"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
    },
  },
  async ({ name, type, documentation, properties }) => {
    if (!ELEMENT_TYPES.has(type)) {
      throw new Error(`Type d'élément invalide: '${type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(await store.createElement(await getActiveWorkspaceId(), { name, type, documentation, properties }));
  }
);

mcpServer.registerTool(
  "update_element",
  {
    description: "Met à jour un élément ArchiMate existant. Seuls les champs fournis sont modifiés.",
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
      throw new Error(`Type d'élément invalide: '${type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    const input: ElementUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    return toContent(await store.updateElement(await getActiveWorkspaceId(), element_id, input));
  }
);

mcpServer.registerTool(
  "delete_element",
  {
    description: "Supprime un élément ArchiMate et toutes les relations qui le référencent.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à supprimer"),
    },
  },
  async ({ element_id }) => {
    await store.deleteElement(await getActiveWorkspaceId(), element_id);
    return toContent({ deleted: true, identifier: element_id });
  }
);

// ---------------------------------------------------------------------------
// Mutation tools – Relationships
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "create_relationship",
  {
    description: `Crée une nouvelle relation ArchiMate entre deux éléments. Types valides: ${_RELATIONSHIP_TYPES_STR}.`,
    inputSchema: {
      type: z.string().describe("Type de relation ArchiMate 3.1 (ex: Association, Composition)"),
      source: z.string().describe("Identifiant de l'élément source"),
      target: z.string().describe("Identifiant de l'élément cible"),
      name: z.string().optional().nullable().describe("Nom de la relation (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
      access_type: z.string().optional().nullable().describe("Type d'accès (Access uniquement): Access, Read, Write, ReadWrite"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée (Association uniquement)"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence (Influence uniquement)"),
    },
  },
  async ({ type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (!RELATIONSHIP_TYPES.has(type)) {
      throw new Error(`Type de relation invalide: '${type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(await store.createRelationship(await getActiveWorkspaceId(), { type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }));
  }
);

mcpServer.registerTool(
  "update_relationship",
  {
    description: "Met à jour une relation ArchiMate existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à modifier"),
      name: z.string().optional().nullable().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de relation"),
      source: z.string().optional().describe("Nouvel identifiant d'élément source"),
      target: z.string().optional().describe("Nouvel identifiant d'élément cible"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés"),
      access_type: z.string().optional().nullable().describe("Type d'accès"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence"),
    },
  },
  async ({ relationship_id, name, type, source, target, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (type && !RELATIONSHIP_TYPES.has(type)) {
      throw new Error(`Type de relation invalide: '${type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
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
    return toContent(await store.updateRelationship(await getActiveWorkspaceId(), relationship_id, input));
  }
);

mcpServer.registerTool(
  "delete_relationship",
  {
    description: "Supprime une relation ArchiMate du modèle.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à supprimer"),
    },
  },
  async ({ relationship_id }) => {
    await store.deleteRelationship(await getActiveWorkspaceId(), relationship_id);
    return toContent({ deleted: true, identifier: relationship_id });
  }
);

mcpServer.registerTool(
  "get_element_relationships",
  {
    description: "Retourne toutes les relations (entrantes et sortantes) d'un élément ArchiMate.",
    inputSchema: { element_id: z.string().describe("Identifiant de l'élément") },
  },
  async ({ element_id }) =>
    toContent(await store.getElementRelationships(await getActiveWorkspaceId(), element_id))
);

mcpServer.registerTool(
  "list_elements_in_views",
  {
    description: "Retourne les identifiants des éléments représentés dans au moins une vue (utile pour distinguer les éléments placés des orphelins).",
    inputSchema: {},
  },
  async () => toContent(await store.listElementsInViews(await getActiveWorkspaceId()))
);

// ---------------------------------------------------------------------------
// Tools – Workspaces
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_workspaces",
  {
    description: "Liste tous les workspaces disponibles et indique lequel est actif.",
    inputSchema: {},
  },
  async () => toContent(await getWorkspaces())
);

mcpServer.registerTool(
  "activate_workspace",
  {
    description: "Active un workspace par son identifiant. Toutes les opérations suivantes (éléments, vues…) portent sur ce workspace.",
    inputSchema: { workspace_id: z.string().describe("Identifiant numérique du workspace (champ 'id' de list_workspaces)") },
  },
  async ({ workspace_id }) => toContent(await activateWorkspace(workspace_id))
);

// ---------------------------------------------------------------------------
// Tools – Import / Export
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "export_model",
  {
    description: "Exporte le modèle ArchiMate actif au format Open Exchange XML (chaîne de caractères).",
    inputSchema: {},
  },
  async () => {
    const xml = await store.exportModelToXml(await getActiveWorkspaceId());
    return { content: [{ type: "text" as const, text: xml }] };
  }
);

mcpServer.registerTool(
  "import_model",
  {
    description: "Importe un modèle ArchiMate depuis du XML Open Exchange Format. Remplace le contenu du workspace actif. Retourne les métadonnées du modèle importé.",
    inputSchema: { xml: z.string().describe("Contenu XML au format Open Exchange (archimate3_Model.xsd)") },
  },
  async ({ xml }) => toContent(await store.importModelFromXml(await getActiveWorkspaceId(), xml))
);

// ---------------------------------------------------------------------------
// Tools – Viewpoints
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_viewpoints",
  {
    description: `Retourne la liste des points de vue ArchiMate disponibles pour les vues. Valides: ${_VIEWPOINTS_STR}.`,
    inputSchema: {},
  },
  async () => toContent([...VIEWPOINTS].sort())
);

// ---------------------------------------------------------------------------
// Tools – propertyDefinitions
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_property_definitions",
  { description: "Liste toutes les définitions de propriétés du modèle ArchiMate.", inputSchema: {} },
  async () => toContent(await store.listPropertyDefinitions(await getActiveWorkspaceId()))
);

mcpServer.registerTool(
  "get_property_definition",
  {
    description: "Retourne le détail d'une définition de propriété par son identifiant.",
    inputSchema: { id: z.string().describe("Identifiant de la définition de propriété") },
  },
  async ({ id }) => toContent(await store.getPropertyDefinitionById(await getActiveWorkspaceId(), id))
);

mcpServer.registerTool(
  "create_property_definition",
  {
    description: `Crée une nouvelle définition de propriété dans le modèle. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de la définition de propriété"),
      type: z.string().optional().describe("Type de données (string par défaut): string, boolean, date, number, enumeration"),
    },
  },
  async ({ name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    return toContent(await store.createPropertyDefinition(await getActiveWorkspaceId(), { name, type }));
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
    return toContent(await store.updatePropertyDefinition(await getActiveWorkspaceId(), id, input));
  }
);

mcpServer.registerTool(
  "delete_property_definition",
  {
    description: "Supprime une définition de propriété et retire toutes les propriétés associées des éléments et relations.",
    inputSchema: { id: z.string().describe("Identifiant de la définition à supprimer") },
  },
  async ({ id }) => {
    await store.deletePropertyDefinition(await getActiveWorkspaceId(), id);
    return toContent({ deleted: true, identifier: id });
  }
);

// ---------------------------------------------------------------------------
// Tools – persistence & rendering
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
    description: "Génère une image SVG d'une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue à rendre"),
    },
  },
  async ({ view_id }) => {
    const model = await store.loadModel(await getActiveWorkspaceId());
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

app.use("/mcp/", (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env["MCP_AUTH_TOKEN"];
  if (!secret) { next(); return; }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  if (provided !== secret) {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32000, message: "Non authentifié." }, id: null });
    return;
  }
  next();
});

app.post("/mcp/", async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { void transport.close(); });
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});
