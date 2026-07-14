/**
 * OpenAPI 3.0 specification for the ArchiSpark REST API.
 * Served as JSON at GET /openapi.json and as Swagger UI at GET /docs.
 *
 * Schemas are registered via @asteasolutions/zod-to-openapi.
 * Input schemas come from validation.ts (Zod). Output schemas are defined here.
 */

import "./validation.js" // ensures extendZodWithOpenApi(z) runs first
import { z } from "zod"
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi"
import packageJson from "../package.json" with { type: "json" }
import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "./schemas.js"
import {
  ElementCreateSchema,
  ElementUpdateSchema,
  RelationshipCreateSchema,
  RelationshipUpdateSchema,
  ViewCreateSchema,
  ViewUpdateSchema,
  NodeCreateSchema,
  NodeUpdateSchema,
  ConnectionCreateSchema,
  ConnectionUpdateSchema,
  PropertyDefinitionCreateSchema,
  PropertyDefinitionUpdateSchema,
  WorkspaceCreateSchema,
  WorkspaceUpdateSchema,
  OrganizationCreateSchema,
  OrganizationUpdateSchema,
  OrganizationMemberCreateSchema,
  OrganizationMemberUpdateSchema,
  OrganizationInvitationCreateSchema,
  PlatformOrganizationUpdateSchema,
  ApiTokenCreateSchema as ApiTokenCreateInputSchema,
} from "./validation.js"

const { version } = packageJson
const registry = new OpenAPIRegistry()

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const elementTypesEnum = [...ELEMENT_TYPES].sort((a, b) =>
  a.localeCompare(b)
) as [string, ...string[]]
const relationshipTypesEnum = [...RELATIONSHIP_TYPES].sort((a, b) =>
  a.localeCompare(b)
) as [string, ...string[]]

// ---------------------------------------------------------------------------
// Reusable output schemas
// ---------------------------------------------------------------------------

const RGBColorSchema = registry.register(
  "RGBColor",
  z
    .object({
      r: z.number().int().min(0).max(255),
      g: z.number().int().min(0).max(255),
      b: z.number().int().min(0).max(255),
    })
    .openapi("RGBColor")
)

const FontSchema = registry.register(
  "Font",
  z
    .object({
      name: z.string().nullable().optional(),
      size: z.number().nullable().optional(),
      style: z.string().nullable().optional(),
      color: RGBColorSchema.nullable().optional(),
    })
    .openapi("Font")
)

const StyleSchema = registry.register(
  "Style",
  z
    .object({
      fill_color: RGBColorSchema.nullable().optional(),
      line_color: RGBColorSchema.nullable().optional(),
      font: FontSchema.nullable().optional(),
      line_width: z.number().nullable().optional(),
    })
    .openapi("Style")
)

const PropertySchema = registry.register(
  "Property",
  z
    .object({
      property_definition_ref: z.string(),
      value: z.string(),
    })
    .openapi("Property")
)

const ModelInfoSchema = registry.register(
  "ModelInfo",
  z
    .object({
      identifier: z.string(),
      name: z.string(),
      documentation: z.string().nullable().optional(),
      version: z.string().nullable().optional(),
      element_count: z.number().int(),
      relationship_count: z.number().int(),
      view_count: z.number().int(),
      property_definition_count: z.number().int(),
      workspace_id: z.string().nullable().optional(),
      workspace_name: z.string().nullable().optional(),
    })
    .openapi("ModelInfo")
)

const ElementSchema = registry.register(
  "Element",
  z
    .object({
      identifier: z.string(),
      name: z.string(),
      type: z.enum(elementTypesEnum),
      documentation: z.string().nullable().optional(),
      properties: z.array(PropertySchema),
    })
    .openapi("Element")
)

const RelationshipSchema = registry.register(
  "Relationship",
  z
    .object({
      identifier: z.string(),
      name: z.string().nullable().optional(),
      type: z.enum(relationshipTypesEnum),
      source: z
        .string()
        .openapi({ description: "Identifiant de l'élément source" }),
      source_name: z.string().nullable().optional(),
      target: z
        .string()
        .openapi({ description: "Identifiant de l'élément cible" }),
      target_name: z.string().nullable().optional(),
      documentation: z.string().nullable().optional(),
      properties: z.array(PropertySchema),
      access_type: z
        .enum(["Access", "Read", "Write", "ReadWrite"])
        .nullable()
        .optional()
        .openapi({ description: "Uniquement pour le type Access" }),
      is_directed: z
        .boolean()
        .nullable()
        .optional()
        .openapi({ description: "Uniquement pour le type Association" }),
      modifier: z.string().nullable().optional().openapi({
        description: "Force d'influence, uniquement pour le type Influence",
      }),
    })
    .openapi("Relationship")
)

// Node is self-referential — children typed as any[] for OpenAPI (doc only, not runtime)
const NodeSchema = registry.register(
  "Node",
  z
    .object({
      identifier: z.string(),
      name: z.string().nullable().optional(),
      element_ref: z.string().nullable().optional(),
      x: z.number().int().nullable().optional(),
      y: z.number().int().nullable().optional(),
      w: z.number().int().nullable().optional(),
      h: z.number().int().nullable().optional(),
      style: StyleSchema.nullable().optional(),
      children: z
        .array(z.any())
        .openapi({ description: "Nœuds enfants (type Node récursif)" }),
    })
    .openapi("Node")
)

const ConnectionSchema = registry.register(
  "Connection",
  z
    .object({
      identifier: z.string(),
      name: z.string().nullable().optional(),
      relationship_ref: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      target: z.string().nullable().optional(),
      source_side: z
        .enum(["top", "right", "bottom", "left"])
        .nullable()
        .optional(),
      target_side: z
        .enum(["top", "right", "bottom", "left"])
        .nullable()
        .optional(),
      style: StyleSchema.nullable().optional(),
    })
    .openapi("Connection")
)

const ViewSchema = registry.register(
  "View",
  z
    .object({
      identifier: z.string(),
      name: z.string(),
      documentation: z.string().nullable().optional(),
      viewpoint: z.string().nullable().optional(),
      node_count: z.number().int(),
      connection_count: z.number().int(),
    })
    .openapi("View")
)

const ViewDetailSchema = registry.register(
  "ViewDetail",
  ViewSchema.extend({
    nodes: z.array(NodeSchema),
    connections: z.array(ConnectionSchema),
  }).openapi("ViewDetail")
)

const SaveResultSchema = registry.register(
  "SaveResult",
  z
    .object({
      saved: z.boolean().openapi({ example: true }),
      path: z.string().openapi({ example: "data/archisurance.xml" }),
    })
    .openapi("SaveResult")
)

const ErrorDetailSchema = registry.register(
  "ErrorDetail",
  z
    .object({
      detail: z.string(),
    })
    .openapi("ErrorDetail")
)

const WorkspaceInfoSchema = registry.register(
  "WorkspaceInfo",
  z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      active: z.boolean(),
      organization_id: z.string(),
      created_by_id: z.string(),
    })
    .openapi("WorkspaceInfo")
)

const OrganizationOutSchema = registry.register(
  "OrganizationOut",
  z
    .object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      is_personal: z.boolean(),
      enabled: z.boolean(),
      role: z.enum(["owner", "admin", "member"]),
      active: z.boolean(),
    })
    .openapi("OrganizationOut")
)

const OrganizationMemberOutSchema = registry.register(
  "OrganizationMemberOut",
  z
    .object({
      user_id: z.string(),
      username: z.string(),
      role: z.enum(["owner", "admin", "member"]),
      created_at: z
        .number()
        .int()
        .openapi({ description: "Timestamp Unix (secondes)" }),
    })
    .openapi("OrganizationMemberOut")
)

const OrganizationInvitationOutSchema = registry.register(
  "OrganizationInvitationOut",
  z
    .object({
      id: z.string(),
      email: z.string(),
      role: z.enum(["owner", "admin", "member"]),
      created_at: z
        .number()
        .int()
        .openapi({ description: "Timestamp Unix (secondes)" }),
      expires_at: z
        .number()
        .int()
        .openapi({ description: "Timestamp Unix (secondes)" }),
      sent_at: z
        .number()
        .int()
        .nullable()
        .openapi({ description: "null si l'envoi SMTP a échoué" }),
      expired: z.boolean(),
    })
    .openapi("OrganizationInvitationOut")
)

const InvitationPreviewOutSchema = registry.register(
  "InvitationPreviewOut",
  z
    .object({
      organization_name: z.string(),
      role: z.enum(["owner", "admin", "member"]),
      email: z.string(),
    })
    .openapi("InvitationPreviewOut")
)

const AcceptInvitationOutSchema = registry.register(
  "AcceptInvitationOut",
  z
    .object({
      organization_id: z.string(),
      role: z.enum(["owner", "admin", "member"]),
    })
    .openapi("AcceptInvitationOut")
)

const PlatformOrganizationOutSchema = registry.register(
  "PlatformOrganizationOut",
  z
    .object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      is_personal: z.boolean(),
      enabled: z.boolean(),
      created_at: z
        .number()
        .int()
        .openapi({ description: "Timestamp Unix (secondes)" }),
    })
    .openapi("PlatformOrganizationOut")
)

const UserOutSchema = registry.register(
  "UserOut",
  z
    .object({
      id: z.string(),
      username: z.string(),
      role: z.string().openapi({ example: "user" }),
      created_at: z.string().datetime(),
    })
    .openapi("UserOut")
)

const ApiTokenOutSchema = registry.register(
  "ApiTokenOut",
  z
    .object({
      id: z.number().int(),
      name: z.string(),
      user_id: z.string(),
      created_at: z
        .number()
        .int()
        .openapi({ description: "Timestamp Unix (secondes)" }),
      last_used_at: z
        .number()
        .int()
        .nullable()
        .openapi({ description: "Timestamp Unix, null si jamais utilisé" }),
      expires_at: z.number().int().nullable().openapi({
        description: "Timestamp Unix d'expiration, null = aucune expiration",
      }),
      organization_id: z.string().optional().openapi({
        description:
          "Absent dans la réponse vue par un platform_admin (isolation des données d'organisation)",
      }),
      workspace_id: z.string().nullable().optional().openapi({
        description:
          "Workspace précis auquel le token est épinglé, null = tout workspace actif de l'organisation",
      }),
    })
    .openapi("ApiTokenOut")
)

const ApiTokenCreateSchema = registry.register(
  "ApiTokenCreate",
  ApiTokenCreateInputSchema.openapi("ApiTokenCreate")
)

const ApiTokenCreatedSchema = registry.register(
  "ApiTokenCreated",
  ApiTokenOutSchema.extend({
    token: z.string().openapi({
      description: "Valeur du token (retournée une seule fois à la création)",
    }),
  }).openapi("ApiTokenCreated")
)

const PropertyDefinitionSchema = registry.register(
  "PropertyDefinition",
  z
    .object({
      identifier: z.string(),
      name: z.string(),
      type: z.string().nullable().optional(),
    })
    .openapi("PropertyDefinition")
)

// ---------------------------------------------------------------------------
// Input schemas (from validation.ts)
// ---------------------------------------------------------------------------

const ElementCreateInput = registry.register(
  "ElementCreateInput",
  ElementCreateSchema.openapi("ElementCreateInput")
)
const ElementUpdateInput = registry.register(
  "ElementUpdateInput",
  ElementUpdateSchema.openapi("ElementUpdateInput")
)
const RelationshipCreateInput = registry.register(
  "RelationshipCreateInput",
  RelationshipCreateSchema.openapi("RelationshipCreateInput")
)
const RelationshipUpdateInput = registry.register(
  "RelationshipUpdateInput",
  RelationshipUpdateSchema.openapi("RelationshipUpdateInput")
)
const ViewCreateInput = registry.register(
  "ViewCreateInput",
  ViewCreateSchema.openapi("ViewCreateInput")
)
registry.register(
  "ViewUpdateInput",
  ViewUpdateSchema.openapi("ViewUpdateInput")
)
const NodeCreateInput = registry.register(
  "NodeCreateInput",
  NodeCreateSchema.openapi("NodeCreateInput")
)
const NodeUpdateInput = registry.register(
  "NodeUpdateInput",
  NodeUpdateSchema.openapi("NodeUpdateInput")
)
const ConnectionCreateInput = registry.register(
  "ConnectionCreateInput",
  ConnectionCreateSchema.openapi("ConnectionCreateInput")
)
const ConnectionUpdateInput = registry.register(
  "ConnectionUpdateInput",
  ConnectionUpdateSchema.openapi("ConnectionUpdateInput")
)
const WorkspaceCreateInput = registry.register(
  "WorkspaceCreateInput",
  WorkspaceCreateSchema.openapi("WorkspaceCreateInput")
)
const WorkspaceUpdateInput = registry.register(
  "WorkspaceUpdateInput",
  WorkspaceUpdateSchema.openapi("WorkspaceUpdateInput")
)
registry.register(
  "PropertyDefinitionCreateInput",
  PropertyDefinitionCreateSchema.openapi("PropertyDefinitionCreateInput")
)
registry.register(
  "PropertyDefinitionUpdateInput",
  PropertyDefinitionUpdateSchema.openapi("PropertyDefinitionUpdateInput")
)
const OrganizationCreateInput = registry.register(
  "OrganizationCreateInput",
  OrganizationCreateSchema.openapi("OrganizationCreateInput")
)
const OrganizationUpdateInput = registry.register(
  "OrganizationUpdateInput",
  OrganizationUpdateSchema.openapi("OrganizationUpdateInput")
)
const OrganizationMemberCreateInput = registry.register(
  "OrganizationMemberCreateInput",
  OrganizationMemberCreateSchema.openapi("OrganizationMemberCreateInput")
)
const OrganizationMemberUpdateInput = registry.register(
  "OrganizationMemberUpdateInput",
  OrganizationMemberUpdateSchema.openapi("OrganizationMemberUpdateInput")
)
const OrganizationInvitationCreateInput = registry.register(
  "OrganizationInvitationCreateInput",
  OrganizationInvitationCreateSchema.openapi(
    "OrganizationInvitationCreateInput"
  )
)
const PlatformOrganizationUpdateInput = registry.register(
  "PlatformOrganizationUpdateInput",
  PlatformOrganizationUpdateSchema.openapi("PlatformOrganizationUpdateInput")
)

// ---------------------------------------------------------------------------
// Reusable responses & security
// ---------------------------------------------------------------------------

const NotFound = {
  description: "Ressource introuvable",
  content: { "application/json": { schema: ErrorDetailSchema } },
}
const UnprocessableType = {
  description: "Type ArchiMate invalide",
  content: { "application/json": { schema: ErrorDetailSchema } },
}
const Unauthorized = {
  description: "Non authentifié",
  content: { "application/json": { schema: ErrorDetailSchema } },
}
const Forbidden = {
  description: "Permission insuffisante",
  content: { "application/json": { schema: ErrorDetailSchema } },
}

// Cookie session OR Bearer token — either is accepted on all protected routes.
const BothAuth: Array<Record<string, string[]>> = [
  { cookieAuth: [] },
  { bearerAuth: [] },
]

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/",
  tags: ["Model"],
  summary: "Métadonnées du modèle",
  operationId: "getModelInfo",
  security: BothAuth,
  responses: {
    200: {
      description: "Informations globales du modèle",
      content: { "application/json": { schema: ModelInfoSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/save",
  tags: ["Model"],
  summary: "Sauvegarder le modèle sur disque",
  operationId: "saveModel",
  security: BothAuth,
  description:
    "Sérialise le modèle en mémoire et l'écrit dans son fichier .xml (Open Exchange File).",
  responses: {
    200: {
      description: "Modèle sauvegardé",
      content: { "application/json": { schema: SaveResultSchema } },
    },
    500: {
      description: "Erreur d'écriture",
      content: { "application/json": { schema: ErrorDetailSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/elements/types",
  tags: ["Elements"],
  summary: "Types d'éléments présents",
  operationId: "listElementTypes",
  security: BothAuth,
  responses: {
    200: {
      description: "Liste triée des types d'éléments ArchiMate 3.1 présents",
      content: {
        "application/json": {
          schema: z
            .array(z.string())
            .openapi({ example: ["ApplicationComponent", "BusinessActor"] }),
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/elements",
  tags: ["Elements"],
  summary: "Lister les éléments",
  operationId: "listElements",
  security: BothAuth,
  request: {
    query: z.object({
      type: z
        .enum(elementTypesEnum)
        .optional()
        .openapi({ description: "Filtrer par type ArchiMate 3.1" }),
      name: z.string().optional().openapi({
        description: "Filtrer par nom (insensible à la casse, sous-chaîne)",
      }),
    }),
  },
  responses: {
    200: {
      description: "Liste des éléments",
      content: { "application/json": { schema: z.array(ElementSchema) } },
    },
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "post",
  path: "/elements",
  tags: ["Elements"],
  summary: "Créer un élément",
  operationId: "createElement",
  security: BothAuth,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ElementCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Élément créé",
      content: { "application/json": { schema: ElementSchema } },
    },
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "get",
  path: "/elements/{identifier}",
  tags: ["Elements"],
  summary: "Détail d'un élément",
  operationId: "getElementById",
  security: BothAuth,
  request: {
    params: z.object({
      identifier: z
        .string()
        .openapi({ description: "Identifiant de l'élément" }),
    }),
  },
  responses: {
    200: {
      description: "Élément ArchiMate",
      content: { "application/json": { schema: ElementSchema } },
    },
    404: NotFound,
  },
})

registry.registerPath({
  method: "put",
  path: "/elements/{identifier}",
  tags: ["Elements"],
  summary: "Modifier un élément",
  operationId: "updateElement",
  security: BothAuth,
  request: {
    params: z.object({ identifier: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: ElementUpdateInput } },
    },
  },
  responses: {
    200: {
      description: "Élément mis à jour",
      content: { "application/json": { schema: ElementSchema } },
    },
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "delete",
  path: "/elements/{identifier}",
  tags: ["Elements"],
  summary: "Supprimer un élément",
  operationId: "deleteElement",
  security: BothAuth,
  request: { params: z.object({ identifier: z.string() }) },
  responses: {
    204: { description: "Élément supprimé (et relations associées)" },
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/relationships/types",
  tags: ["Relationships"],
  summary: "Types de relations présents",
  operationId: "listRelationshipTypes",
  security: BothAuth,
  responses: {
    200: {
      description: "Liste triée des types de relations ArchiMate 3.1 présents",
      content: {
        "application/json": {
          schema: z
            .array(z.string())
            .openapi({ example: ["Association", "Flow"] }),
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/relationships",
  tags: ["Relationships"],
  summary: "Lister les relations",
  operationId: "listRelationships",
  security: BothAuth,
  request: {
    query: z.object({
      type: z
        .enum(relationshipTypesEnum)
        .optional()
        .openapi({ description: "Filtrer par type de relation" }),
      source_id: z.string().optional().openapi({
        description: "Filtrer par identifiant de l'élément source",
      }),
      target_id: z
        .string()
        .optional()
        .openapi({ description: "Filtrer par identifiant de l'élément cible" }),
    }),
  },
  responses: {
    200: {
      description: "Liste des relations",
      content: { "application/json": { schema: z.array(RelationshipSchema) } },
    },
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "post",
  path: "/relationships",
  tags: ["Relationships"],
  summary: "Créer une relation",
  operationId: "createRelationship",
  security: BothAuth,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RelationshipCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Relation créée",
      content: { "application/json": { schema: RelationshipSchema } },
    },
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "get",
  path: "/relationships/{identifier}",
  tags: ["Relationships"],
  summary: "Détail d'une relation",
  operationId: "getRelationshipById",
  security: BothAuth,
  request: {
    params: z.object({
      identifier: z
        .string()
        .openapi({ description: "Identifiant de la relation" }),
    }),
  },
  responses: {
    200: {
      description: "Relation ArchiMate",
      content: { "application/json": { schema: RelationshipSchema } },
    },
    404: NotFound,
  },
})

registry.registerPath({
  method: "put",
  path: "/relationships/{identifier}",
  tags: ["Relationships"],
  summary: "Modifier une relation",
  operationId: "updateRelationship",
  security: BothAuth,
  request: {
    params: z.object({ identifier: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: RelationshipUpdateInput } },
    },
  },
  responses: {
    200: {
      description: "Relation mise à jour",
      content: { "application/json": { schema: RelationshipSchema } },
    },
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "delete",
  path: "/relationships/{identifier}",
  tags: ["Relationships"],
  summary: "Supprimer une relation",
  operationId: "deleteRelationship",
  security: BothAuth,
  request: { params: z.object({ identifier: z.string() }) },
  responses: {
    204: { description: "Relation supprimée" },
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/views",
  tags: ["Views"],
  summary: "Lister les vues",
  operationId: "listViews",
  security: BothAuth,
  responses: {
    200: {
      description: "Liste des vues avec compteurs",
      content: { "application/json": { schema: z.array(ViewSchema) } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/views",
  tags: ["Views"],
  summary: "Créer une vue",
  operationId: "createView",
  security: BothAuth,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ViewCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Vue créée",
      content: { "application/json": { schema: ViewDetailSchema } },
    },
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "get",
  path: "/views/{identifier}",
  tags: ["Views"],
  summary: "Détail d'une vue",
  operationId: "getViewById",
  security: BothAuth,
  request: {
    params: z.object({
      identifier: z.string().openapi({ description: "Identifiant de la vue" }),
    }),
  },
  responses: {
    200: {
      description: "Vue avec nœuds et connexions",
      content: { "application/json": { schema: ViewDetailSchema } },
    },
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/views/{view_id}/image",
  tags: ["Views"],
  summary: "Rendu SVG d'une vue",
  operationId: "renderView",
  security: BothAuth,
  request: {
    params: z.object({
      view_id: z.string().openapi({ description: "Identifiant de la vue" }),
    }),
    query: z.object({
      format: z.enum(["svg"]).default("svg").optional().openapi({
        description:
          "Format de sortie (svg uniquement ; l'export PNG se fait côté client)",
      }),
    }),
  },
  responses: {
    200: {
      description: "Image SVG de la vue",
      content: { "image/svg+xml": { schema: z.string() } },
    },
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "post",
  path: "/views/{view_id}/nodes",
  tags: ["Views"],
  summary: "Ajouter un nœud à une vue",
  operationId: "createNode",
  security: BothAuth,
  request: {
    params: z.object({
      view_id: z.string().openapi({ description: "Identifiant de la vue" }),
    }),
    body: {
      required: true,
      content: { "application/json": { schema: NodeCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Nœud créé",
      content: { "application/json": { schema: NodeSchema } },
    },
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "put",
  path: "/views/{view_id}/nodes/{node_id}",
  tags: ["Views"],
  summary: "Déplacer / redimensionner un nœud",
  operationId: "updateNode",
  request: {
    params: z.object({ view_id: z.string(), node_id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: NodeUpdateInput } },
    },
  },
  responses: {
    200: {
      description: "Nœud mis à jour",
      content: { "application/json": { schema: NodeSchema } },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "delete",
  path: "/views/{view_id}/nodes/{node_id}",
  tags: ["Views"],
  summary: "Retirer un nœud d'une vue",
  operationId: "deleteNode",
  request: { params: z.object({ view_id: z.string(), node_id: z.string() }) },
  responses: {
    204: { description: "Nœud retiré" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/views/{view_id}/connections",
  tags: ["Views"],
  summary: "Créer une connexion dans une vue",
  operationId: "createConnection",
  security: BothAuth,
  request: {
    params: z.object({ view_id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: ConnectionCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Connexion créée",
      content: { "application/json": { schema: ConnectionSchema } },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "put",
  path: "/views/{view_id}/connections/{conn_id}",
  tags: ["Views"],
  summary: "Modifier une connexion",
  operationId: "updateConnection",
  request: {
    params: z.object({ view_id: z.string(), conn_id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: ConnectionUpdateInput } },
    },
  },
  responses: {
    200: {
      description: "Connexion mise à jour",
      content: { "application/json": { schema: ConnectionSchema } },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "delete",
  path: "/views/{view_id}/connections/{conn_id}",
  tags: ["Views"],
  summary: "Supprimer une connexion",
  operationId: "deleteConnection",
  request: { params: z.object({ view_id: z.string(), conn_id: z.string() }) },
  responses: {
    204: { description: "Connexion supprimée" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Utilisateur courant",
  operationId: "getMe",
  security: BothAuth,
  description:
    "Retourne les informations de l'utilisateur authentifié (cookie de session ou Bearer token).",
  responses: {
    200: {
      description: "Utilisateur connecté",
      content: { "application/json": { schema: UserOutSchema } },
    },
    401: Unauthorized,
  },
})

registry.registerPath({
  method: "get",
  path: "/workspaces",
  tags: ["Workspaces"],
  summary: "Lister les workspaces",
  operationId: "listWorkspaces",
  security: BothAuth,
  responses: {
    200: {
      description: "Liste des workspaces",
      content: { "application/json": { schema: z.array(WorkspaceInfoSchema) } },
    },
    401: Unauthorized,
  },
})

registry.registerPath({
  method: "post",
  path: "/workspaces",
  tags: ["Workspaces"],
  summary: "Créer un workspace",
  operationId: "createWorkspace",
  security: BothAuth,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: WorkspaceCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Workspace créé",
      content: { "application/json": { schema: WorkspaceInfoSchema } },
    },
    401: Unauthorized,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "put",
  path: "/workspaces/{id}",
  tags: ["Workspaces"],
  summary: "Modifier un workspace (nom, description, équipes)",
  operationId: "updateWorkspace",
  security: BothAuth,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: WorkspaceUpdateInput } },
    },
  },
  responses: {
    200: {
      description: "Workspace mis à jour",
      content: { "application/json": { schema: WorkspaceInfoSchema } },
    },
    401: Unauthorized,
    404: NotFound,
  },
})

registry.registerPath({
  method: "delete",
  path: "/workspaces/{id}",
  tags: ["Workspaces"],
  summary: "Supprimer un workspace",
  operationId: "deleteWorkspace",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: "Workspace supprimé" },
    401: Unauthorized,
    404: NotFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/workspaces/{id}/activate",
  tags: ["Workspaces"],
  summary: "Activer un workspace",
  operationId: "activateWorkspace",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Workspace activé",
      content: { "application/json": { schema: WorkspaceInfoSchema } },
    },
    401: Unauthorized,
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/organizations",
  tags: ["Organizations"],
  summary: "Lister mes organisations",
  operationId: "listOrganizations",
  security: BothAuth,
  description:
    "Retourne les organisations dont l'utilisateur est membre. Vide pour un platform_admin (isolation structurelle).",
  responses: {
    200: {
      description: "Liste des organisations",
      content: {
        "application/json": { schema: z.array(OrganizationOutSchema) },
      },
    },
    401: Unauthorized,
  },
})

registry.registerPath({
  method: "post",
  path: "/organizations",
  tags: ["Organizations"],
  summary: "Créer une organisation d'équipe",
  operationId: "createOrganization",
  security: BothAuth,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: OrganizationCreateInput } },
    },
  },
  responses: {
    201: {
      description: "Organisation créée",
      content: { "application/json": { schema: OrganizationOutSchema } },
    },
    401: Unauthorized,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "put",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Renommer une organisation",
  operationId: "renameOrganization",
  security: BothAuth,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: OrganizationUpdateInput } },
    },
  },
  responses: {
    200: {
      description: "Organisation renommée",
      content: { "application/json": { schema: OrganizationOutSchema } },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "delete",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Supprimer une organisation (owner uniquement)",
  operationId: "deleteOrganization",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: "Organisation supprimée" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/organizations/{id}/activate",
  tags: ["Organizations"],
  summary: "Activer une organisation",
  operationId: "activateOrganization",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Organisation activée",
      content: { "application/json": { schema: OrganizationOutSchema } },
    },
    401: Unauthorized,
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/organizations/{id}/members",
  tags: ["Organizations"],
  summary: "Lister les membres d'une organisation",
  operationId: "listOrganizationMembers",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Membres de l'organisation",
      content: {
        "application/json": { schema: z.array(OrganizationMemberOutSchema) },
      },
    },
    401: Unauthorized,
    404: NotFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/organizations/{id}/members",
  tags: ["Organizations"],
  summary: "Ajouter un membre par username (owner uniquement)",
  operationId: "addOrganizationMember",
  security: BothAuth,
  description:
    "L'utilisateur doit déjà exister dans Keycloak. Pour inviter quelqu'un qui n'a pas encore de compte, voir POST /organizations/{id}/invitations.",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": { schema: OrganizationMemberCreateInput },
      },
    },
  },
  responses: {
    201: {
      description: "Membre ajouté",
      content: { "application/json": { schema: OrganizationMemberOutSchema } },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "put",
  path: "/organizations/{id}/members/{userId}",
  tags: ["Organizations"],
  summary: "Modifier le rôle d'un membre (owner uniquement)",
  operationId: "updateOrganizationMemberRole",
  security: BothAuth,
  request: {
    params: z.object({ id: z.string(), userId: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": { schema: OrganizationMemberUpdateInput },
      },
    },
  },
  responses: {
    200: {
      description: "Rôle mis à jour",
      content: { "application/json": { schema: OrganizationMemberOutSchema } },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "delete",
  path: "/organizations/{id}/members/{userId}",
  tags: ["Organizations"],
  summary: "Retirer un membre (owner uniquement)",
  operationId: "removeOrganizationMember",
  security: BothAuth,
  request: { params: z.object({ id: z.string(), userId: z.string() }) },
  responses: {
    204: { description: "Membre retiré" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "get",
  path: "/organizations/{id}/invitations",
  tags: ["Organizations"],
  summary: "Lister les invitations en attente d'une organisation",
  operationId: "listOrganizationInvitations",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Invitations en attente",
      content: {
        "application/json": {
          schema: z.array(OrganizationInvitationOutSchema),
        },
      },
    },
    401: Unauthorized,
    404: NotFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/organizations/{id}/invitations",
  tags: ["Organizations"],
  summary: "Inviter par e-mail (owner uniquement)",
  operationId: "createOrganizationInvitation",
  security: BothAuth,
  description:
    "Crée (ou remplace une invitation active existante pour le même e-mail) et envoie un e-mail avec un lien d'acceptation. sent_at reste null si l'envoi SMTP a échoué — l'invitation existe mais doit être renvoyée.",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": { schema: OrganizationInvitationCreateInput },
      },
    },
  },
  responses: {
    201: {
      description: "Invitation créée",
      content: {
        "application/json": { schema: OrganizationInvitationOutSchema },
      },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "delete",
  path: "/organizations/{id}/invitations/{invitationId}",
  tags: ["Organizations"],
  summary: "Révoquer une invitation (owner uniquement)",
  operationId: "revokeOrganizationInvitation",
  security: BothAuth,
  request: {
    params: z.object({ id: z.string(), invitationId: z.string() }),
  },
  responses: {
    204: { description: "Invitation révoquée" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/organizations/{id}/invitations/{invitationId}/resend",
  tags: ["Organizations"],
  summary: "Renvoyer une invitation (owner uniquement)",
  operationId: "resendOrganizationInvitation",
  security: BothAuth,
  description:
    "Révoque l'invitation existante et en émet une nouvelle avec le même e-mail/rôle — même mécanisme que la création.",
  request: {
    params: z.object({ id: z.string(), invitationId: z.string() }),
  },
  responses: {
    201: {
      description: "Invitation renvoyée",
      content: {
        "application/json": { schema: OrganizationInvitationOutSchema },
      },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/invitations/{token}",
  tags: ["Organizations"],
  summary: "Prévisualiser une invitation par token",
  operationId: "getInvitationPreview",
  security: BothAuth,
  description:
    "Authentification requise (comme toute route de l'API) mais pas de contrôle d'appartenance à l'organisation — l'appelant n'est par définition pas encore membre.",
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: {
      description: "Détails de l'invitation",
      content: { "application/json": { schema: InvitationPreviewOutSchema } },
    },
    401: Unauthorized,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "post",
  path: "/invitations/{token}/accept",
  tags: ["Organizations"],
  summary: "Accepter une invitation",
  operationId: "acceptInvitation",
  security: BothAuth,
  description:
    "Nécessite un e-mail Keycloak vérifié et identique à l'e-mail invité, en plus d'un token valide et non expiré.",
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: {
      description: "Invitation acceptée — membre ajouté",
      content: { "application/json": { schema: AcceptInvitationOutSchema } },
    },
    401: Unauthorized,
    404: NotFound,
    422: UnprocessableType,
  },
})

registry.registerPath({
  method: "get",
  path: "/platform/organizations",
  tags: ["Platform"],
  summary: "Lister toutes les organisations (platform_admin)",
  operationId: "listAllOrganizations",
  security: BothAuth,
  description:
    "Métadonnées seules — aucun accès au contenu (workspaces) des organisations.",
  responses: {
    200: {
      description: "Toutes les organisations",
      content: {
        "application/json": { schema: z.array(PlatformOrganizationOutSchema) },
      },
    },
    401: Unauthorized,
    403: Forbidden,
  },
})

registry.registerPath({
  method: "put",
  path: "/platform/organizations/{id}",
  tags: ["Platform"],
  summary: "Suspendre/réactiver une organisation (platform_admin)",
  operationId: "setOrganizationEnabled",
  security: BothAuth,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": { schema: PlatformOrganizationUpdateInput },
      },
    },
  },
  responses: {
    200: {
      description: "Organisation mise à jour",
      content: {
        "application/json": { schema: PlatformOrganizationOutSchema },
      },
    },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "delete",
  path: "/platform/organizations/{id}",
  tags: ["Platform"],
  summary: "Supprimer une organisation (platform_admin)",
  operationId: "deleteOrganizationAsPlatformAdmin",
  security: BothAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: "Organisation supprimée" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
  },
})

registry.registerPath({
  method: "get",
  path: "/property-definitions",
  tags: ["PropertyDefinitions"],
  summary: "Lister les définitions de propriétés",
  operationId: "listPropertyDefinitions",
  security: BothAuth,
  responses: {
    200: {
      description: "Définitions de propriétés",
      content: {
        "application/json": { schema: z.array(PropertyDefinitionSchema) },
      },
    },
    401: Unauthorized,
  },
})

// ---------------------------------------------------------------------------
// Settings — API tokens
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/settings/api-tokens",
  tags: ["Settings"],
  summary: "Lister les tokens API",
  operationId: "listApiTokens",
  security: BothAuth,
  description:
    "Retourne les tokens de l'utilisateur courant. Les administrateurs voient tous les tokens.",
  responses: {
    200: {
      description: "Liste des tokens",
      content: { "application/json": { schema: z.array(ApiTokenOutSchema) } },
    },
    401: Unauthorized,
  },
})

registry.registerPath({
  method: "post",
  path: "/settings/api-tokens",
  tags: ["Settings"],
  summary: "Créer un token API",
  operationId: "createApiToken",
  security: BothAuth,
  description:
    "Crée un nouveau token personnel. La valeur du token (champ `token`) n'est retournée qu'à la création — elle ne peut plus être récupérée ensuite.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ApiTokenCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Token créé (contient la valeur en clair)",
      content: { "application/json": { schema: ApiTokenCreatedSchema } },
    },
    401: Unauthorized,
    422: {
      description: "Champ 'name' manquant ou vide",
      content: { "application/json": { schema: ErrorDetailSchema } },
    },
  },
})

registry.registerPath({
  method: "delete",
  path: "/settings/api-tokens/{id}",
  tags: ["Settings"],
  summary: "Supprimer un token API",
  operationId: "deleteApiToken",
  security: BothAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: "ID numérique du token" }),
    }),
  },
  responses: {
    204: { description: "Token supprimé" },
    401: Unauthorized,
    403: Forbidden,
    404: NotFound,
    422: {
      description: "ID non numérique",
      content: { "application/json": { schema: ErrorDetailSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/mcp/",
  tags: ["MCP"],
  summary: "Requête MCP (JSON-RPC)",
  operationId: "mcpPost",
  description:
    "Point d'entrée JSON-RPC 2.0 du transport streamable-http MCP. " +
    "La première requête doit être une `initialize`. " +
    "Les requêtes suivantes doivent inclure l'en-tête `mcp-session-id` retourné par `initialize`.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: z.object({}) } },
    },
  },
  responses: {
    200: {
      description: "Réponse JSON-RPC (text/event-stream ou application/json)",
    },
    400: {
      description: "Session invalide ou requête non-initialize sans session",
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/mcp/",
  tags: ["MCP"],
  summary: "Flux SSE MCP",
  operationId: "mcpGet",
  request: {
    headers: z.object({ "mcp-session-id": z.string() }),
  },
  responses: {
    200: { description: "Flux d'événements SSE" },
    405: { description: "Session non trouvée" },
  },
})

registry.registerPath({
  method: "delete",
  path: "/mcp/",
  tags: ["MCP"],
  summary: "Fermer une session MCP",
  operationId: "mcpDelete",
  request: {
    headers: z.object({ "mcp-session-id": z.string() }),
  },
  responses: {
    200: { description: "Session fermée" },
    404: { description: "Session non trouvée" },
  },
})

// ---------------------------------------------------------------------------
// Generate spec
// ---------------------------------------------------------------------------

const generator = new OpenApiGeneratorV3(registry.definitions)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _doc: Record<string, any> = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "ArchiSpark API",
    version,
    description:
      "API REST pour interroger et modifier un modèle ArchiMate 3.1. " +
      "Authentification via cookie de session (access_token Keycloak) ou Bearer token (token API personnel). " +
      "Chaque workspace appartient à un seul utilisateur.",
    contact: {
      name: "GitHub",
      url: "https://github.com/archispark/archispark",
    },
  },
  servers: [
    { url: "https://api.archispark.cloud", description: "Production" },
    { url: "http://localhost:3000", description: "Serveur local" },
  ],
  tags: [
    { name: "Auth", description: "Authentification (Keycloak)" },
    { name: "Model", description: "Informations et persistance du modèle" },
    {
      name: "Organizations",
      description: "Organisations et membres (owner/admin/member)",
    },
    {
      name: "Platform",
      description:
        "Administration plateforme (platform_admin) — métadonnées d'organisation seules",
    },
    { name: "Workspaces", description: "Gestion des workspaces" },
    { name: "Elements", description: "Éléments ArchiMate 3.1" },
    { name: "Relationships", description: "Relations ArchiMate 3.1" },
    { name: "Views", description: "Vues et diagrammes" },
    { name: "PropertyDefinitions", description: "Définitions de propriétés" },
    { name: "Settings", description: "Tokens API personnels" },
    { name: "MCP", description: "Transport MCP (streamable-http)" },
  ],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openApiSpec: Record<string, any> = {
  ..._doc,
  components: {
    ..._doc.components,
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "access_token",
        description:
          "Cookie de session httpOnly contenant le token d'accès Keycloak, défini après /api/auth/callback",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "Token API personnel. Créez-en un via POST /settings/api-tokens (Mon compte → Tokens dans l'interface). " +
          "Envoyez-le dans l'en-tête : Authorization: Bearer <token>.",
      },
    },
  },
}
