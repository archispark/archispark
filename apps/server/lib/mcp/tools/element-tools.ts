import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  createElement,
  updateElement,
  deleteElement,
  getElementRelationships,
  listElementsInViews,
} from "@/lib/archimate/store"
import { ELEMENT_TYPES } from "@/lib/archimate/schemas"
import type { ElementUpdateIn } from "@/lib/archimate/schemas"
import { elementTypeError, elementCreationHints } from "../archimate-guide"
import { toContent, propertyItemSchema } from "./shared"

export function registerElementTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
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
        type: z
          .string()
          .describe(
            "Type ArchiMate 3.1. Exemples: ApplicationComponent (Application), " +
              "BusinessActor (Business actif), BusinessProcess (Business comportemental), " +
              "Node (Technology actif), DataObject (Application passif)"
          ),
        documentation: z
          .string()
          .optional()
          .nullable()
          .describe("Documentation ou description de l'élément"),
        properties: z
          .array(propertyItemSchema)
          .optional()
          .describe("Propriétés personnalisées"),
      },
    },
    async ({ name, type, documentation, properties }) => {
      if (!ELEMENT_TYPES.has(type)) {
        throw new Error(elementTypeError(type))
      }
      const element = await createElement(
        await activeWorkspaceId(auth, "write"),
        {
          name,
          type,
          documentation,
          properties,
        }
      )
      return toContent({ ...element, hints: elementCreationHints(type) })
    }
  )

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
        documentation: z
          .string()
          .optional()
          .nullable()
          .describe("Nouvelle documentation (null pour effacer)"),
        properties: z
          .array(propertyItemSchema)
          .optional()
          .describe("Nouvelles propriétés (remplace les existantes)"),
      },
    },
    async ({ element_id, name, type, documentation, properties }) => {
      if (type && !ELEMENT_TYPES.has(type)) {
        throw new Error(elementTypeError(type))
      }
      const input: ElementUpdateIn = {}
      if (name !== undefined) input.name = name
      if (type !== undefined) input.type = type
      if (documentation !== undefined) input.documentation = documentation
      if (properties !== undefined) input.properties = properties
      return toContent(
        await updateElement(
          await activeWorkspaceId(auth, "write"),
          element_id,
          input
        )
      )
    }
  )

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
      await deleteElement(await activeWorkspaceId(auth, "write"), element_id)
      return toContent({ deleted: true, identifier: element_id })
    }
  )

  mcpServer.registerTool(
    "get_element_relationships",
    {
      description:
        "Retourne toutes les relations (entrantes et sortantes) d'un élément ArchiMate. " +
        "Utile pour vérifier la cohérence sémantique d'un élément avant de le modifier ou supprimer.",
      inputSchema: {
        element_id: z.string().describe("Identifiant de l'élément"),
      },
    },
    async ({ element_id }) => {
      return toContent(
        await getElementRelationships(
          await activeWorkspaceId(auth, "read"),
          element_id
        )
      )
    }
  )

  mcpServer.registerTool(
    "list_elements_in_views",
    {
      description:
        "Retourne les identifiants des éléments placés dans au moins une vue. " +
        "Utile pour distinguer les éléments modélisés (avec représentation visuelle) " +
        "des éléments orphelins (présents dans le modèle mais sans vue).",
      inputSchema: {},
    },
    async () =>
      toContent(
        await listElementsInViews(await activeWorkspaceId(auth, "read"))
      )
  )
}
