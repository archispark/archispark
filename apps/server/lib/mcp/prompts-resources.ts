import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
  LAYERS_RESOURCE_TEXT,
  RELATIONSHIPS_RESOURCE_TEXT,
  MODELING_GUIDE_PROMPT,
  VIEWPOINT_GUIDE_PROMPT_PREFIX,
} from "./archimate-guide"
import { VIEWPOINTS_STR } from "./tools/shared"

export function registerPromptsAndResources(mcpServer: McpServer): void {
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
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: MODELING_GUIDE_PROMPT },
        },
      ],
    })
  )

  mcpServer.registerPrompt(
    "create-viewpoint-view",
    {
      title: "Créer une vue pour un viewpoint donné",
      description:
        "Guide pas-à-pas pour créer une vue ArchiMate adaptée à un viewpoint spécifique " +
        "(Organization, Application Structure, Technology, Layered, etc.).",
      argsSchema: {
        viewpoint: z
          .string()
          .describe(`Viewpoint ArchiMate cible. Valides: ${VIEWPOINTS_STR}`),
      },
    },
    async ({ viewpoint }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${VIEWPOINT_GUIDE_PROMPT_PREFIX}\nViewpoint demandé: **${viewpoint}**\n\nCommence par appeler create_view avec viewpoint="${viewpoint}".`,
          },
        },
      ],
    })
  )

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
      contents: [
        {
          uri: "archimate://layers",
          text: LAYERS_RESOURCE_TEXT,
          mimeType: "application/json",
        },
      ],
    })
  )

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
      contents: [
        {
          uri: "archimate://relationships",
          text: RELATIONSHIPS_RESOURCE_TEXT,
          mimeType: "application/json",
        },
      ],
    })
  )
}
