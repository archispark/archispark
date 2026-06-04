/**
 * OpenAPI 3.0 specification for the mcp-archimate REST API.
 * Served as JSON at GET /openapi.json and as Swagger UI at GET /docs.
 *
 * Request body schemas are auto-generated from the Zod schemas in validation.ts.
 */

import packageJson from "../package.json" with { type: "json" };
const { version } = packageJson;
import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "./schemas.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ElementCreateSchema, ElementUpdateSchema,
  RelationshipCreateSchema, RelationshipUpdateSchema,
  ViewCreateSchema, ViewUpdateSchema,
  NodeCreateSchema, NodeUpdateSchema,
  ConnectionCreateSchema, ConnectionUpdateSchema,
  PropertyDefinitionCreateSchema, PropertyDefinitionUpdateSchema,
  WorkspaceCreateSchema, WorkspaceUpdateSchema,
  RoleCreateSchema, RoleUpdateSchema,
} from "./validation.js";

function toOpenApiSchema(zodSchema: unknown): unknown {
  const s = zodToJsonSchema(zodSchema as Parameters<typeof zodToJsonSchema>[0], { target: "openApi3" }) as Record<string, unknown>;
  // Remove $schema key which isn't needed inline
  const { $schema: _, ...rest } = s;
  return rest;
}

const elementTypesEnum = [...ELEMENT_TYPES].sort();
const relationshipTypesEnum = [...RELATIONSHIP_TYPES].sort();

// ---------------------------------------------------------------------------
// Reusable schema objects
// ---------------------------------------------------------------------------

const RGBColor = {
  type: "object",
  properties: {
    r: { type: "integer", minimum: 0, maximum: 255 },
    g: { type: "integer", minimum: 0, maximum: 255 },
    b: { type: "integer", minimum: 0, maximum: 255 },
  },
  required: ["r", "g", "b"],
};

const Font = {
  type: "object",
  properties: {
    name:  { type: "string", nullable: true },
    size:  { type: "number", nullable: true },
    style: { type: "string", nullable: true },
    color: { $ref: "#/components/schemas/RGBColor", nullable: true },
  },
};

const Style = {
  type: "object",
  properties: {
    fill_color:  { $ref: "#/components/schemas/RGBColor", nullable: true },
    line_color:  { $ref: "#/components/schemas/RGBColor", nullable: true },
    font:        { $ref: "#/components/schemas/Font",     nullable: true },
    line_width:  { type: "number", nullable: true },
  },
};

const Property = {
  type: "object",
  required: ["property_definition_ref", "value"],
  properties: {
    property_definition_ref: { type: "string" },
    value:                   { type: "string" },
  },
};

const ModelInfo = {
  type: "object",
  required: ["identifier", "name", "element_count", "relationship_count", "view_count", "property_definition_count"],
  properties: {
    identifier:                  { type: "string" },
    name:                        { type: "string" },
    documentation:               { type: "string", nullable: true },
    version:                     { type: "string", nullable: true },
    element_count:               { type: "integer" },
    relationship_count:          { type: "integer" },
    view_count:                  { type: "integer" },
    property_definition_count:   { type: "integer" },
    workspace_id:                { type: "string", nullable: true },
    workspace_name:              { type: "string", nullable: true },
  },
};

const Element = {
  type: "object",
  required: ["identifier", "name", "type", "properties"],
  properties: {
    identifier:    { type: "string" },
    name:          { type: "string" },
    type:          { type: "string", enum: elementTypesEnum },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
  },
};

const Relationship = {
  type: "object",
  required: ["identifier", "type", "source", "target", "properties"],
  properties: {
    identifier:    { type: "string" },
    name:          { type: "string", nullable: true },
    type:          { type: "string", enum: relationshipTypesEnum },
    source:        { type: "string", description: "Identifiant de l'element source" },
    source_name:   { type: "string", nullable: true },
    target:        { type: "string", description: "Identifiant de l'element cible" },
    target_name:   { type: "string", nullable: true },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
    access_type:   { type: "string", enum: ["Access", "Read", "Write", "ReadWrite"], nullable: true,
                     description: "Uniquement pour le type Access" },
    is_directed:   { type: "boolean", nullable: true,
                     description: "Uniquement pour le type Association" },
    modifier:      { type: "string", nullable: true,
                     description: "Force d'influence, uniquement pour le type Influence" },
  },
};

const Node: Record<string, unknown> = {
  type: "object",
  required: ["identifier", "children"],
  properties: {
    identifier:  { type: "string" },
    name:        { type: "string", nullable: true },
    element_ref: { type: "string", nullable: true },
    x:           { type: "integer", nullable: true },
    y:           { type: "integer", nullable: true },
    w:           { type: "integer", nullable: true },
    h:           { type: "integer", nullable: true },
    style:       { $ref: "#/components/schemas/Style", nullable: true },
    children:    { type: "array", items: { $ref: "#/components/schemas/Node" } },
  },
};

const Connection = {
  type: "object",
  required: ["identifier"],
  properties: {
    identifier:       { type: "string" },
    name:             { type: "string", nullable: true },
    relationship_ref: { type: "string", nullable: true },
    source:           { type: "string", nullable: true },
    target:           { type: "string", nullable: true },
    source_side:      { type: "string", enum: ["top", "right", "bottom", "left"], nullable: true },
    target_side:      { type: "string", enum: ["top", "right", "bottom", "left"], nullable: true },
    style:            { $ref: "#/components/schemas/Style", nullable: true },
  },
};

const View = {
  type: "object",
  required: ["identifier", "name", "node_count", "connection_count"],
  properties: {
    identifier:       { type: "string" },
    name:             { type: "string" },
    documentation:    { type: "string", nullable: true },
    viewpoint:        { type: "string", nullable: true },
    node_count:       { type: "integer" },
    connection_count: { type: "integer" },
  },
};

const ViewDetail = {
  allOf: [
    { $ref: "#/components/schemas/View" },
    {
      type: "object",
      required: ["nodes", "connections"],
      properties: {
        nodes:       { type: "array", items: { $ref: "#/components/schemas/Node" } },
        connections: { type: "array", items: { $ref: "#/components/schemas/Connection" } },
      },
    },
  ],
};

const ErrorDetail = {
  type: "object",
  required: ["detail"],
  properties: {
    detail: { type: "string" },
  },
};

const ElementCreateInput = toOpenApiSchema(ElementCreateSchema);
const ElementUpdateInput = toOpenApiSchema(ElementUpdateSchema);
const RelationshipCreateInput = toOpenApiSchema(RelationshipCreateSchema);
const RelationshipUpdateInput = toOpenApiSchema(RelationshipUpdateSchema);

const SaveResult = {
  type: "object",
  required: ["saved", "path"],
  properties: {
    saved: { type: "boolean", example: true },
    path:  { type: "string", example: "data/archisurance.xml" },
  },
};

const ViewCreateInput = toOpenApiSchema(ViewCreateSchema);
const ViewUpdateInput = toOpenApiSchema(ViewUpdateSchema);
const NodeCreateInput = toOpenApiSchema(NodeCreateSchema);
const NodeUpdateInput = toOpenApiSchema(NodeUpdateSchema);
const ConnectionCreateInput = toOpenApiSchema(ConnectionCreateSchema);
const ConnectionUpdateInput = toOpenApiSchema(ConnectionUpdateSchema);

const WorkspaceCreateInput = toOpenApiSchema(WorkspaceCreateSchema);
const WorkspaceUpdateInput = toOpenApiSchema(WorkspaceUpdateSchema);

const WorkspaceInfo = {
  type: "object",
  required: ["id", "name", "active"],
  properties: {
    id:     { type: "string" },
    name:   { type: "string" },
    path:   { type: "string", nullable: true },
    active: { type: "boolean" },
  },
};

const UserOut = {
  type: "object",
  required: ["id", "username", "role", "created_at"],
  properties: {
    id:         { type: "string" },
    username:   { type: "string" },
    role:       { type: "string", example: "user" },
    created_at: { type: "string", format: "date-time" },
  },
};

const RoleOut = {
  type: "object",
  required: ["id", "name", "is_system", "created_at", "permissions", "user_ids"],
  properties: {
    id:          { type: "string" },
    name:        { type: "string" },
    description: { type: "string", nullable: true },
    is_system:   { type: "boolean" },
    created_at:  { type: "string", format: "date-time" },
    permissions: {
      type: "object",
      description: "Map de layer → liste de flags (read|create|update|delete)",
      additionalProperties: { type: "array", items: { type: "string" } },
    },
    user_ids: { type: "array", items: { type: "string" } },
  },
};

const PropertyDefinitionCreateInput = toOpenApiSchema(PropertyDefinitionCreateSchema);
const PropertyDefinitionUpdateInput = toOpenApiSchema(PropertyDefinitionUpdateSchema);
const RoleCreateInput = toOpenApiSchema(RoleCreateSchema);
const RoleUpdateInput = toOpenApiSchema(RoleUpdateSchema);

const PropertyDefinition = {
  type: "object",
  required: ["identifier", "name"],
  properties: {
    identifier: { type: "string" },
    name:       { type: "string" },
    type:       { type: "string", nullable: true },
  },
};

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ArchiSpark API",
    version,
    description:
      "API REST pour interroger et modifier un modèle ArchiMate 3.1. " +
      "Authentification via Better Auth (cookie httpOnly). Permissions RBAC par couche ArchiMate.",
    contact: { name: "GitHub", url: "https://github.com/archispark/archispark" },
  },
  servers: [{ url: "http://localhost:3000", description: "Serveur local" }],

  tags: [
    { name: "Auth",               description: "Authentification (Better Auth)" },
    { name: "Model",              description: "Informations et persistance du modèle" },
    { name: "Workspaces",         description: "Gestion des workspaces" },
    { name: "Elements",           description: "Éléments ArchiMate 3.1" },
    { name: "Relationships",      description: "Relations ArchiMate 3.1" },
    { name: "Views",              description: "Vues et diagrammes" },
    { name: "PropertyDefinitions", description: "Définitions de propriétés" },
    { name: "Users",              description: "Gestion des utilisateurs" },
    { name: "Roles",              description: "Rôles et permissions RBAC" },
    { name: "MCP",                description: "Transport MCP (streamable-http)" },
  ],

  paths: {
    "/": {
      get: {
        tags: ["Model"],
        summary: "Métadonnées du modèle",
        operationId: "getModelInfo",
        responses: {
          "200": {
            description: "Informations globales du modèle",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ModelInfo" } } },
          },
        },
      },
    },

    "/save": {
      post: {
        tags: ["Model"],
        summary: "Sauvegarder le modèle sur disque",
        operationId: "saveModel",
        description: "Sérialise le modèle en mémoire et l'écrit dans son fichier .xml (Open Exchange File).",
        responses: {
          "200": {
            description: "Modèle sauvegardé",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SaveResult" } } },
          },
          "500": { description: "Erreur d'écriture", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } } },
        },
      },
    },

    "/elements/types": {
      get: {
        tags: ["Elements"],
        summary: "Types d'éléments présents",
        operationId: "listElementTypes",
        responses: {
          "200": {
            description: "Liste triée des types d'éléments ArchiMate 3.1 présents",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["ApplicationComponent", "BusinessActor"] },
              },
            },
          },
        },
      },
    },

    "/elements": {
      get: {
        tags: ["Elements"],
        summary: "Lister les éléments",
        operationId: "listElements",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: elementTypesEnum },
            description: "Filtrer par type ArchiMate 3.1",
          },
          {
            name: "name",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par nom (insensible a la casse, sous-chaine)",
          },
        ],
        responses: {
          "200": {
            description: "Liste des éléments",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Element" } },
              },
            },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      post: {
        tags: ["Elements"],
        summary: "Créer un élément",
        operationId: "createElement",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ElementCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Élément créé",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/elements/{identifier}": {
      get: {
        tags: ["Elements"],
        summary: "Détail d'un élément",
        operationId: "getElementById",
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de l'élément",
          },
        ],
        responses: {
          "200": {
            description: "Élément ArchiMate",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Elements"],
        summary: "Modifier un élément",
        operationId: "updateElement",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ElementUpdateInput" } } },
        },
        responses: {
          "200": {
            description: "Élément mis à jour",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      delete: {
        tags: ["Elements"],
        summary: "Supprimer un élément",
        operationId: "deleteElement",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Élément supprimé (et relations associées)" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/relationships/types": {
      get: {
        tags: ["Relationships"],
        summary: "Types de relations présents",
        operationId: "listRelationshipTypes",
        responses: {
          "200": {
            description: "Liste triée des types de relations ArchiMate 3.1 présents",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["Association", "Flow"] },
              },
            },
          },
        },
      },
    },

    "/relationships": {
      get: {
        tags: ["Relationships"],
        summary: "Lister les relations",
        operationId: "listRelationships",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: relationshipTypesEnum },
            description: "Filtrer par type de relation",
          },
          {
            name: "source_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par identifiant de l'élément source",
          },
          {
            name: "target_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par identifiant de l'élément cible",
          },
        ],
        responses: {
          "200": {
            description: "Liste des relations",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Relationship" } },
              },
            },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      post: {
        tags: ["Relationships"],
        summary: "Créer une relation",
        operationId: "createRelationship",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RelationshipCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Relation créée",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/relationships/{identifier}": {
      get: {
        tags: ["Relationships"],
        summary: "Détail d'une relation",
        operationId: "getRelationshipById",
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la relation",
          },
        ],
        responses: {
          "200": {
            description: "Relation ArchiMate",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Relationships"],
        summary: "Modifier une relation",
        operationId: "updateRelationship",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RelationshipUpdateInput" } } },
        },
        responses: {
          "200": {
            description: "Relation mise à jour",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
      delete: {
        tags: ["Relationships"],
        summary: "Supprimer une relation",
        operationId: "deleteRelationship",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Relation supprimée" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/views": {
      get: {
        tags: ["Views"],
        summary: "Lister les vues",
        operationId: "listViews",
        responses: {
          "200": {
            description: "Liste des vues avec compteurs",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/View" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Views"],
        summary: "Créer une vue",
        operationId: "createView",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ViewCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Vue créée",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ViewDetail" } } },
          },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/views/{view_id}/nodes": {
      post: {
        tags: ["Views"],
        summary: "Ajouter un nœud à une vue",
        operationId: "createNode",
        parameters: [
          { name: "view_id", in: "path", required: true, schema: { type: "string" }, description: "Identifiant de la vue" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/NodeCreateInput" } } },
        },
        responses: {
          "201": {
            description: "Nœud créé",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/views/{view_id}/image": {
      get: {
        tags: ["Views"],
        summary: "Rendu SVG d'une vue",
        operationId: "renderView",
        parameters: [
          {
            name: "view_id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la vue",
          },
          {
            name: "format",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["svg"], default: "svg" },
            description: "Format de sortie (svg uniquement ; l'export PNG se fait côté client)",
          },
        ],
        responses: {
          "200": {
            description: "Image SVG de la vue",
            content: {
              "image/svg+xml": { schema: { type: "string", format: "binary" } },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/views/{identifier}": {
      get: {
        tags: ["Views"],
        summary: "Détail d'une vue",
        operationId: "getViewById",
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la vue",
          },
        ],
        responses: {
          "200": {
            description: "Vue avec nœuds et connexions",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ViewDetail" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/me": {
      get: {
        tags: ["Auth"],
        summary: "Utilisateur courant",
        operationId: "getMe",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Utilisateur connecté", content: { "application/json": { schema: { $ref: "#/components/schemas/UserOut" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/workspaces": {
      get: {
        tags: ["Workspaces"],
        summary: "Lister les workspaces",
        operationId: "listWorkspaces",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Liste des workspaces", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WorkspaceInfo" } } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Workspaces"],
        summary: "Créer un workspace",
        operationId: "createWorkspace",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: WorkspaceCreateInput } },
        },
        responses: {
          "201": { description: "Workspace créé", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceInfo" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/workspaces/{id}": {
      put: {
        tags: ["Workspaces"],
        summary: "Renommer un workspace",
        operationId: "updateWorkspace",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: WorkspaceUpdateInput } } },
        responses: {
          "200": { description: "Workspace mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceInfo" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Workspaces"],
        summary: "Supprimer un workspace",
        operationId: "deleteWorkspace",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "Workspace supprimé" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/workspaces/{id}/activate": {
      post: {
        tags: ["Workspaces"],
        summary: "Activer un workspace",
        operationId: "activateWorkspace",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Workspace activé", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceInfo" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/users": {
      get: {
        tags: ["Users"],
        summary: "Lister les utilisateurs",
        operationId: "listUsers",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Liste des utilisateurs", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/UserOut" } } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/users/{uid}/roles": {
      get: {
        tags: ["Users"],
        summary: "Rôles d'un utilisateur",
        operationId: "listUserRoles",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "uid", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Rôles assignés", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/RoleOut" } } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/roles": {
      get: {
        tags: ["Roles"],
        summary: "Lister les rôles",
        operationId: "listRoles",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Liste des rôles RBAC", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/RoleOut" } } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Roles"],
        summary: "Créer un rôle",
        operationId: "createRole",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string", nullable: true }, permissions: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } } } } } },
        },
        responses: {
          "201": { description: "Rôle créé", content: { "application/json": { schema: { $ref: "#/components/schemas/RoleOut" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/roles/{id}": {
      get: {
        tags: ["Roles"],
        summary: "Détail d'un rôle",
        operationId: "getRole",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Rôle", content: { "application/json": { schema: { $ref: "#/components/schemas/RoleOut" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Roles"],
        summary: "Modifier un rôle",
        operationId: "updateRole",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string", nullable: true }, permissions: { type: "object" } } } } } },
        responses: {
          "200": { description: "Rôle mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/RoleOut" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Roles"],
        summary: "Supprimer un rôle",
        operationId: "deleteRole",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "Rôle supprimé" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/roles/{id}/layers/{layer}": {
      get: {
        tags: ["Roles"],
        summary: "Permissions d'un rôle sur une couche",
        operationId: "getRoleLayer",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "layer", in: "path", required: true, schema: { type: "string" }, description: "Couche ArchiMate ou 'Relations'/'Views'" },
        ],
        responses: {
          "200": { description: "Permissions", content: { "application/json": { schema: { type: "array", items: { type: "string" } } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Roles"],
        summary: "Définir permissions sur une couche",
        operationId: "setRoleLayer",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "layer", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { permissions: { type: "array", items: { type: "string", enum: ["read", "create", "update", "delete"] } } } } } } },
        responses: {
          "200": { description: "Permissions mises à jour" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      delete: {
        tags: ["Roles"],
        summary: "Supprimer permissions sur une couche",
        operationId: "deleteRoleLayer",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "layer", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Permissions supprimées" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/roles/{id}/users/{uid}": {
      put: {
        tags: ["Roles"],
        summary: "Assigner un utilisateur à un rôle",
        operationId: "assignUserToRole",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "uid", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Assignation effectuée" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Roles"],
        summary: "Retirer un utilisateur d'un rôle",
        operationId: "unassignUserFromRole",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "uid", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Désassignation effectuée" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/property-definitions": {
      get: {
        tags: ["PropertyDefinitions"],
        summary: "Lister les définitions de propriétés",
        operationId: "listPropertyDefinitions",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Définitions de propriétés", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/PropertyDefinition" } } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/views/{view_id}/nodes/{node_id}": {
      put: {
        tags: ["Views"],
        summary: "Déplacer / redimensionner un nœud",
        operationId: "updateNode",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "view_id", in: "path", required: true, schema: { type: "string" } },
          { name: "node_id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/NodeUpdateInput" } } } },
        responses: {
          "200": { description: "Nœud mis à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Views"],
        summary: "Retirer un nœud d'une vue",
        operationId: "deleteNode",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "view_id", in: "path", required: true, schema: { type: "string" } },
          { name: "node_id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Nœud retiré" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/views/{view_id}/connections": {
      post: {
        tags: ["Views"],
        summary: "Créer une connexion dans une vue",
        operationId: "createConnection",
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "view_id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ConnectionCreateInput" } } } },
        responses: {
          "201": { description: "Connexion créée", content: { "application/json": { schema: { $ref: "#/components/schemas/Connection" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/views/{view_id}/connections/{conn_id}": {
      put: {
        tags: ["Views"],
        summary: "Modifier une connexion",
        operationId: "updateConnection",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "view_id", in: "path", required: true, schema: { type: "string" } },
          { name: "conn_id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ConnectionUpdateInput" } } } },
        responses: {
          "200": { description: "Connexion mise à jour", content: { "application/json": { schema: { $ref: "#/components/schemas/Connection" } } } },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Views"],
        summary: "Supprimer une connexion",
        operationId: "deleteConnection",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "view_id", in: "path", required: true, schema: { type: "string" } },
          { name: "conn_id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Connexion supprimée" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/mcp/": {
      post: {
        tags: ["MCP"],
        summary: "Requête MCP (JSON-RPC)",
        operationId: "mcpPost",
        description:
          "Point d'entrée JSON-RPC 2.0 du transport streamable-http MCP. " +
          "La première requête doit être une `initialize`. " +
          "Les requêtes suivantes doivent inclure l'en-tête `mcp-session-id` retourné par `initialize`.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Réponse JSON-RPC (text/event-stream ou application/json)" },
          "400": { description: "Session invalide ou requête non-initialize sans session" },
        },
      },
      get: {
        tags: ["MCP"],
        summary: "Flux SSE MCP",
        operationId: "mcpGet",
        parameters: [
          { name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Flux d'événements SSE" },
          "405": { description: "Session non trouvée" },
        },
      },
      delete: {
        tags: ["MCP"],
        summary: "Fermer une session MCP",
        operationId: "mcpDelete",
        parameters: [
          { name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Session fermée" },
          "404": { description: "Session non trouvée" },
        },
      },
    },
  },

  components: {
    schemas: {
      RGBColor,
      Font,
      Style,
      Property,
      SaveResult,
      ModelInfo,
      Element,
      ElementCreateInput,
      ElementUpdateInput,
      Relationship,
      RelationshipCreateInput,
      RelationshipUpdateInput,
      Node,
      NodeCreateInput,
      NodeUpdateInput,
      Connection,
      ConnectionCreateInput,
      ConnectionUpdateInput,
      View,
      ViewDetail,
      ViewCreateInput,
      ViewUpdateInput,
      WorkspaceInfo,
      WorkspaceCreateInput,
      WorkspaceUpdateInput,
      UserOut,
      RoleOut,
      RoleCreateInput,
      RoleUpdateInput,
      PropertyDefinition,
      PropertyDefinitionCreateInput,
      PropertyDefinitionUpdateInput,
      ErrorDetail,
    },
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Cookie de session httpOnly défini par Better Auth après /auth/sign-in/username",
      },
    },
    responses: {
      NotFound: {
        description: "Ressource introuvable",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
      UnprocessableType: {
        description: "Type ArchiMate invalide",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
      Unauthorized: {
        description: "Non authentifié",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
      Forbidden: {
        description: "Permission insuffisante",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
    },
  },
};
