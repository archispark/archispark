import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  listPropertyDefinitions,
  getPropertyDefinitionById,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
} from "@/lib/archimate/store"
import { PROPERTY_DEFINITION_TYPES } from "@/lib/archimate/schemas"
import type { PropertyDefinitionUpdateIn } from "@/lib/archimate/schemas"
import { toContent, PROPERTY_DEFINITION_TYPES_STR } from "./shared"

export function registerPropertyDefinitionTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
  mcpServer.registerTool(
    "list_property_definitions",
    {
      description:
        "Liste toutes les définitions de propriétés du modèle ArchiMate. " +
        "Le champ is_system indique les définitions protégées par ArchiSpark.",
      inputSchema: {},
    },
    async () =>
      toContent(
        await listPropertyDefinitions(await activeWorkspaceId(auth, "read"))
      )
  )

  mcpServer.registerTool(
    "get_property_definition",
    {
      description:
        "Retourne le détail d'une définition de propriété par son identifiant.",
      inputSchema: {
        id: z.string().describe("Identifiant de la définition de propriété"),
      },
    },
    async ({ id }) =>
      toContent(
        await getPropertyDefinitionById(
          await activeWorkspaceId(auth, "read"),
          id
        )
      )
  )

  mcpServer.registerTool(
    "create_property_definition",
    {
      description: `Crée une définition de propriété personnalisée dans le modèle. Types valides: ${PROPERTY_DEFINITION_TYPES_STR}.`,
      inputSchema: {
        name: z.string().describe("Nom de la propriété"),
        type: z
          .string()
          .optional()
          .describe(
            "Type de données: string (défaut), boolean, date, number, enumeration"
          ),
      },
    },
    async ({ name, type }) => {
      if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
        throw new Error(
          `Type invalide: '${type}'. Types valides: ${PROPERTY_DEFINITION_TYPES_STR}`
        )
      }
      return toContent(
        await createPropertyDefinition(await activeWorkspaceId(auth, "write"), {
          name,
          type,
        })
      )
    }
  )

  mcpServer.registerTool(
    "update_property_definition",
    {
      description:
        "Met à jour une définition utilisateur existante. Les définitions système sont protégées.",
      inputSchema: {
        id: z.string().describe("Identifiant de la définition à modifier"),
        name: z.string().optional().describe("Nouveau nom"),
        type: z.string().optional().describe("Nouveau type de données"),
      },
    },
    async ({ id, name, type }) => {
      if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
        throw new Error(
          `Type invalide: '${type}'. Types valides: ${PROPERTY_DEFINITION_TYPES_STR}`
        )
      }
      const input: PropertyDefinitionUpdateIn = {}
      if (name !== undefined) input.name = name
      if (type !== undefined) input.type = type
      return toContent(
        await updatePropertyDefinition(
          await activeWorkspaceId(auth, "write"),
          id,
          input
        )
      )
    }
  )

  mcpServer.registerTool(
    "delete_property_definition",
    {
      description:
        "Supprime une définition utilisateur et retire toutes les propriétés associées " +
        "des éléments et relations du modèle.",
      inputSchema: {
        id: z.string().describe("Identifiant de la définition à supprimer"),
      },
    },
    async ({ id }) => {
      await deletePropertyDefinition(await activeWorkspaceId(auth, "write"), id)
      return toContent({ deleted: true, identifier: id })
    }
  )
}
