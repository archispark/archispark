import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  getModelInfo,
  listElementTypes,
  listElements,
  getElementById,
  listRelationshipTypes,
  listRelationships,
  getRelationshipById,
  listViews,
  getViewById,
} from "@/lib/archimate/store"
import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "@/lib/archimate/schemas"
import {
  ELEMENT_TYPES_BY_LAYER,
  RELATIONSHIP_SEMANTICS,
  elementTypeError,
  relationshipTypeError,
} from "../archimate-guide"
import { toContent } from "./shared"

export function registerReadTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
  mcpServer.registerTool(
    "get_model_info",
    {
      description:
        "Retourne les métadonnées du workspace actif: identifiant, nom, version, " +
        "et compteurs d'éléments/relations/vues. " +
        "Appeler en premier pour vérifier quel modèle est chargé avant de modéliser.",
      inputSchema: {},
    },
    async () =>
      toContent(await getModelInfo(await activeWorkspaceId(auth, "read")))
  )

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
      const presentTypes = await listElementTypes(
        await activeWorkspaceId(auth, "read")
      )
      const presentSet = new Set(presentTypes)

      const grouped: Record<string, unknown> = {}
      for (const [layer, data] of Object.entries(ELEMENT_TYPES_BY_LAYER)) {
        const layerResult: Record<string, unknown> = {
          description: (data as { description: string }).description,
        }
        if ("elements" in data) {
          layerResult["elements"] = (data.elements as readonly string[]).filter(
            (t) => presentSet.has(t)
          )
          layerResult["all_types"] = data.elements
        } else {
          const d = data as {
            active?: readonly string[]
            behavioral?: readonly string[]
            passive?: readonly string[]
          }
          if (d.active)
            layerResult["active"] = d.active.filter((t) => presentSet.has(t))
          if (d.behavioral)
            layerResult["behavioral"] = d.behavioral.filter((t) =>
              presentSet.has(t)
            )
          if (d.passive)
            layerResult["passive"] = d.passive.filter((t) => presentSet.has(t))
          if (d.active) layerResult["all_active"] = d.active
          if (d.behavioral) layerResult["all_behavioral"] = d.behavioral
          if (d.passive) layerResult["all_passive"] = d.passive
        }
        grouped[layer] = layerResult
      }
      return toContent({
        layers: grouped,
        note: "Les listes sans préfixe 'all_' ne contiennent que les types présents dans ce modèle.",
      })
    }
  )

  mcpServer.registerTool(
    "list_elements",
    {
      description:
        "Liste les éléments du modèle avec filtres optionnels. " +
        "Utiliser element_type pour filtrer par couche (ex: BusinessProcess, ApplicationComponent). " +
        "Utiliser name pour une recherche insensible à la casse. " +
        "Appeler list_element_types pour voir les types disponibles groupés par couche.",
      inputSchema: {
        element_type: z
          .string()
          .optional()
          .describe(
            "Type ArchiMate 3.1 (ex: ApplicationComponent, BusinessActor)"
          ),
        name: z
          .string()
          .optional()
          .describe("Filtre par nom (insensible à la casse, sous-chaîne)"),
      },
    },
    async ({ element_type, name }) => {
      if (element_type && !ELEMENT_TYPES.has(element_type)) {
        throw new Error(elementTypeError(element_type))
      }
      return toContent(
        await listElements(
          await activeWorkspaceId(auth, "read"),
          element_type,
          name
        )
      )
    }
  )

  mcpServer.registerTool(
    "get_element",
    {
      description:
        "Retourne le détail complet d'un élément ArchiMate par son identifiant: " +
        "type, nom, documentation et propriétés personnalisées. " +
        "L'identifiant est le champ 'identifier' retourné par list_elements ou create_element.",
      inputSchema: {
        element_id: z
          .string()
          .describe("Identifiant de l'élément (champ 'identifier')"),
      },
    },
    async ({ element_id }) =>
      toContent(
        await getElementById(await activeWorkspaceId(auth, "read"), element_id)
      )
  )

  mcpServer.registerTool(
    "list_relationship_types",
    {
      description:
        "Retourne les types de relations ArchiMate 3.1 présents dans le modèle. " +
        "Pour la sémantique détaillée de chaque type, consulter la ressource archimate://relationships.",
      inputSchema: {},
    },
    async () => {
      const types = await listRelationshipTypes(
        await activeWorkspaceId(auth, "read")
      )
      const withSemantics = types.map((t: string) => ({
        type: t,
        description: RELATIONSHIP_SEMANTICS[t]?.description ?? "",
        direction: RELATIONSHIP_SEMANTICS[t]?.direction ?? "",
      }))
      return toContent(withSemantics)
    }
  )

  mcpServer.registerTool(
    "list_relationships",
    {
      description:
        "Liste les relations du modèle avec filtres optionnels. " +
        "rel_type filtre par type de relation ArchiMate 3.1. " +
        "source_id_filter et target_id filtrent par identifiant d'élément source ou cible.",
      inputSchema: {
        rel_type: z
          .string()
          .optional()
          .describe(
            "Type de relation ArchiMate 3.1 (ex: Assignment, Realization, Serving)"
          ),
        source_id_filter: z
          .string()
          .optional()
          .describe("Filtrer par identifiant d'élément source"),
        target_id: z
          .string()
          .optional()
          .describe("Filtrer par identifiant d'élément cible"),
      },
    },
    async ({ rel_type, source_id_filter, target_id }) => {
      if (rel_type && !RELATIONSHIP_TYPES.has(rel_type)) {
        throw new Error(relationshipTypeError(rel_type))
      }
      return toContent(
        await listRelationships(
          await activeWorkspaceId(auth, "read"),
          rel_type,
          source_id_filter,
          target_id
        )
      )
    }
  )

  mcpServer.registerTool(
    "get_relationship",
    {
      description:
        "Retourne le détail d'une relation ArchiMate par son identifiant: " +
        "type, source, cible, nom et propriétés.",
      inputSchema: {
        relationship_id: z
          .string()
          .describe("Identifiant de la relation (champ 'identifier')"),
      },
    },
    async ({ relationship_id }) => {
      return toContent(
        await getRelationshipById(
          await activeWorkspaceId(auth, "read"),
          relationship_id
        )
      )
    }
  )

  mcpServer.registerTool(
    "list_views",
    {
      description:
        "Liste toutes les vues du modèle avec leur viewpoint, nombre de nœuds et de connexions. " +
        "Chaque vue correspond à un diagramme ArchiMate ciblant un public précis.",
      inputSchema: {},
    },
    async () => {
      return toContent(await listViews(await activeWorkspaceId(auth, "read")))
    }
  )

  mcpServer.registerTool(
    "get_view",
    {
      description:
        "Retourne le détail d'une vue ArchiMate: viewpoint, nœuds (éléments placés) " +
        "et connexions (relations représentées). " +
        "Utiliser render_view pour obtenir le SVG visuel.",
      inputSchema: {
        view_id: z
          .string()
          .describe("Identifiant de la vue (champ 'identifier')"),
      },
    },
    async ({ view_id }) => {
      return toContent(
        await getViewById(await activeWorkspaceId(auth, "read"), view_id)
      )
    }
  )
}
