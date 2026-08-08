import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  createRelationship,
  updateRelationship,
  deleteRelationship,
} from "@/lib/archimate/store"
import { RELATIONSHIP_TYPES } from "@/lib/archimate/schemas"
import type { RelationshipUpdateIn } from "@/lib/archimate/schemas"
import {
  relationshipTypeError,
  relationshipCreationHints,
} from "../archimate-guide"
import { toContent, propertyItemSchema } from "./shared"

export function registerRelationshipTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
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
        type: z
          .string()
          .describe(
            "Type de relation ArchiMate 3.1: Assignment, Realization, Serving, Access, " +
              "Composition, Aggregation, Influence, Triggering, Flow, Specialization, Association"
          ),
        source: z.string().describe("Identifiant de l'élément source"),
        target: z.string().describe("Identifiant de l'élément cible"),
        name: z
          .string()
          .optional()
          .nullable()
          .describe("Nom de la relation (optionnel)"),
        documentation: z
          .string()
          .optional()
          .nullable()
          .describe("Documentation"),
        properties: z
          .array(propertyItemSchema)
          .optional()
          .describe("Propriétés personnalisées"),
        access_type: z
          .string()
          .optional()
          .nullable()
          .describe(
            "Type d'accès (Access uniquement): Access, Read, Write, ReadWrite"
          ),
        is_directed: z
          .boolean()
          .optional()
          .nullable()
          .describe("Relation dirigée (Association uniquement)"),
        influence_strength: z
          .string()
          .optional()
          .nullable()
          .describe(
            "Force d'influence (Influence uniquement, ex: '++', '+', '-')"
          ),
      },
    },
    async ({
      type,
      source,
      target,
      name,
      documentation,
      properties,
      access_type,
      is_directed,
      influence_strength,
    }) => {
      if (!RELATIONSHIP_TYPES.has(type)) {
        throw new Error(relationshipTypeError(type))
      }
      const relationship = await createRelationship(
        await activeWorkspaceId(auth, "write"),
        {
          type,
          source,
          target,
          name,
          documentation,
          properties,
          access_type,
          is_directed,
          influence_strength,
        }
      )
      return toContent({
        ...relationship,
        hints: relationshipCreationHints(type),
      })
    }
  )

  mcpServer.registerTool(
    "update_relationship",
    {
      description:
        "Met à jour une relation ArchiMate existante. " +
        "Seuls les champs fournis sont modifiés.",
      inputSchema: {
        relationship_id: z
          .string()
          .describe("Identifiant de la relation à modifier"),
        name: z.string().optional().nullable().describe("Nouveau nom"),
        type: z
          .string()
          .optional()
          .describe("Nouveau type de relation ArchiMate 3.1"),
        source: z
          .string()
          .optional()
          .describe("Nouvel identifiant d'élément source"),
        target: z
          .string()
          .optional()
          .describe("Nouvel identifiant d'élément cible"),
        documentation: z
          .string()
          .optional()
          .nullable()
          .describe("Nouvelle documentation"),
        properties: z
          .array(propertyItemSchema)
          .optional()
          .describe("Nouvelles propriétés"),
        access_type: z
          .string()
          .optional()
          .nullable()
          .describe("Type d'accès (Access uniquement)"),
        is_directed: z
          .boolean()
          .optional()
          .nullable()
          .describe("Relation dirigée"),
        influence_strength: z
          .string()
          .optional()
          .nullable()
          .describe("Force d'influence"),
      },
    },
    async ({
      relationship_id,
      name,
      type,
      source,
      target,
      documentation,
      properties,
      access_type,
      is_directed,
      influence_strength,
    }) => {
      if (type && !RELATIONSHIP_TYPES.has(type)) {
        throw new Error(relationshipTypeError(type))
      }
      const input: RelationshipUpdateIn = {}
      if (name !== undefined) input.name = name
      if (type !== undefined) input.type = type
      if (source !== undefined) input.source = source
      if (target !== undefined) input.target = target
      if (documentation !== undefined) input.documentation = documentation
      if (properties !== undefined) input.properties = properties
      if (access_type !== undefined) input.access_type = access_type
      if (is_directed !== undefined) input.is_directed = is_directed
      if (influence_strength !== undefined)
        input.influence_strength = influence_strength
      return toContent(
        await updateRelationship(
          await activeWorkspaceId(auth, "write"),
          relationship_id,
          input
        )
      )
    }
  )

  mcpServer.registerTool(
    "delete_relationship",
    {
      description:
        "Supprime une relation ArchiMate du modèle. " +
        "Les connexions visuelles associées dans les vues sont également supprimées.",
      inputSchema: {
        relationship_id: z
          .string()
          .describe("Identifiant de la relation à supprimer"),
      },
    },
    async ({ relationship_id }) => {
      await deleteRelationship(
        await activeWorkspaceId(auth, "write"),
        relationship_id
      )
      return toContent({ deleted: true, identifier: relationship_id })
    }
  )
}
