import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  createView,
  createNode,
  updateView,
  deleteView,
  updateViewNode,
  deleteViewNode,
  createViewConnection,
  updateViewConnection,
  deleteViewConnection,
  loadModel,
} from "@/lib/archimate/store"
import { renderViewToSvg } from "@/lib/archimate/renderer"
import type {
  ViewUpdateIn,
  NodeUpdateIn,
  ConnectionCreateIn,
  ConnectionUpdateIn,
} from "@/lib/archimate/schemas"
import { toContent, VIEWPOINTS_STR, EDGE_SIDES_STR } from "./shared"

export function registerViewTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
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
        viewpoint: z
          .string()
          .optional()
          .nullable()
          .describe(`Point de vue ArchiMate. Valides: ${VIEWPOINTS_STR}`),
        documentation: z
          .string()
          .optional()
          .nullable()
          .describe("Documentation de la vue (optionnel)"),
      },
    },
    async ({ name, viewpoint, documentation }) => {
      const view = await createView(await activeWorkspaceId(auth, "write"), {
        name,
        viewpoint,
        documentation,
      })
      return toContent({
        ...view,
        next_steps: [
          "Appeler list_elements pour trouver les éléments à afficher",
          "Appeler create_node pour chaque élément à placer dans cette vue",
          "Appeler create_connection pour représenter les relations visuellement",
          "Appeler render_view pour visualiser le résultat",
        ],
      })
    }
  )

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
        element_id: z
          .string()
          .describe("Identifiant de l'élément à représenter"),
        x: z
          .number()
          .optional()
          .nullable()
          .describe("Position X en pixels (optionnel)"),
        y: z
          .number()
          .optional()
          .nullable()
          .describe("Position Y en pixels (optionnel)"),
        w: z
          .number()
          .optional()
          .nullable()
          .describe("Largeur en pixels (optionnel, défaut ~120)"),
        h: z
          .number()
          .optional()
          .nullable()
          .describe("Hauteur en pixels (optionnel, défaut ~55)"),
      },
    },
    async ({ view_id, element_id, x, y, w, h }) => {
      return toContent(
        await createNode(await activeWorkspaceId(auth, "write"), view_id, {
          element_id,
          x,
          y,
          w,
          h,
        })
      )
    }
  )

  mcpServer.registerTool(
    "update_view",
    {
      description:
        "Met à jour le nom, le viewpoint ou la documentation d'une vue ArchiMate. " +
        "Seuls les champs fournis sont modifiés.",
      inputSchema: {
        view_id: z.string().describe("Identifiant de la vue à modifier"),
        name: z.string().optional().describe("Nouveau nom"),
        viewpoint: z
          .string()
          .optional()
          .nullable()
          .describe(`Nouveau viewpoint ArchiMate. Valides: ${VIEWPOINTS_STR}`),
        documentation: z
          .string()
          .optional()
          .nullable()
          .describe("Nouvelle documentation (null pour effacer)"),
      },
    },
    async ({ view_id, name, viewpoint, documentation }) => {
      const input: ViewUpdateIn = {}
      if (name !== undefined) input.name = name
      if (viewpoint !== undefined) input.viewpoint = viewpoint
      if (documentation !== undefined) input.documentation = documentation
      return toContent(
        await updateView(await activeWorkspaceId(auth, "write"), view_id, input)
      )
    }
  )

  mcpServer.registerTool(
    "delete_view",
    {
      description:
        "Supprime une vue ArchiMate du modèle. " +
        "Les éléments et relations sous-jacents ne sont PAS supprimés — " +
        "seule la représentation visuelle est effacée.",
      inputSchema: {
        view_id: z.string().describe("Identifiant de la vue à supprimer"),
      },
    },
    async ({ view_id }) => {
      await deleteView(await activeWorkspaceId(auth, "write"), view_id)
      return toContent({ deleted: true, identifier: view_id })
    }
  )

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
        name: z
          .string()
          .optional()
          .nullable()
          .describe(
            "Nom affiché sur le nœud (remplace le nom de l'élément dans cette vue)"
          ),
      },
    },
    async ({ view_id, node_id, x, y, w, h, name }) => {
      const input: NodeUpdateIn = {}
      if (x !== undefined) input.x = x
      if (y !== undefined) input.y = y
      if (w !== undefined) input.w = w
      if (h !== undefined) input.h = h
      if (name !== undefined) input.name = name
      return toContent(
        await updateViewNode(
          await activeWorkspaceId(auth, "write"),
          view_id,
          node_id,
          input
        )
      )
    }
  )

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
      await deleteViewNode(
        await activeWorkspaceId(auth, "write"),
        view_id,
        node_id
      )
      return toContent({ deleted: true, identifier: node_id })
    }
  )

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
        relationship_id: z
          .string()
          .optional()
          .nullable()
          .describe(
            "Identifiant de la relation ArchiMate sous-jacente (recommandé pour la sémantique)"
          ),
        name: z
          .string()
          .optional()
          .nullable()
          .describe("Nom de la connexion (optionnel)"),
        source_side: z
          .string()
          .optional()
          .nullable()
          .describe(`Côté du nœud source: ${EDGE_SIDES_STR}`),
        target_side: z
          .string()
          .optional()
          .nullable()
          .describe(`Côté du nœud cible: ${EDGE_SIDES_STR}`),
      },
    },
    async ({
      view_id,
      source,
      target,
      relationship_id,
      name,
      source_side,
      target_side,
    }) => {
      return toContent(
        await createViewConnection(
          await activeWorkspaceId(auth, "write"),
          view_id,
          {
            source,
            target,
            relationship_id,
            name,
            source_side: source_side as ConnectionCreateIn["source_side"],
            target_side: target_side as ConnectionCreateIn["target_side"],
          }
        )
      )
    }
  )

  mcpServer.registerTool(
    "update_connection",
    {
      description:
        "Met à jour une connexion dans une vue ArchiMate. " +
        "Seuls les champs fournis sont modifiés.",
      inputSchema: {
        view_id: z.string().describe("Identifiant de la vue"),
        connection_id: z.string().describe("Identifiant de la connexion"),
        name: z
          .string()
          .optional()
          .nullable()
          .describe("Nouveau nom (null pour effacer)"),
        source: z
          .string()
          .optional()
          .describe("Nouvel identifiant de nœud source"),
        target: z
          .string()
          .optional()
          .describe("Nouvel identifiant de nœud cible"),
        source_side: z
          .string()
          .optional()
          .nullable()
          .describe(`Côté du nœud source: ${EDGE_SIDES_STR}`),
        target_side: z
          .string()
          .optional()
          .nullable()
          .describe(`Côté du nœud cible: ${EDGE_SIDES_STR}`),
      },
    },
    async ({
      view_id,
      connection_id,
      name,
      source,
      target,
      source_side,
      target_side,
    }) => {
      const input: ConnectionUpdateIn = {}
      if (name !== undefined) input.name = name
      if (source !== undefined) input.source = source
      if (target !== undefined) input.target = target
      if (source_side !== undefined)
        input.source_side = source_side as ConnectionUpdateIn["source_side"]
      if (target_side !== undefined)
        input.target_side = target_side as ConnectionUpdateIn["target_side"]
      return toContent(
        await updateViewConnection(
          await activeWorkspaceId(auth, "write"),
          view_id,
          connection_id,
          input
        )
      )
    }
  )

  mcpServer.registerTool(
    "delete_connection",
    {
      description:
        "Supprime une connexion visuelle d'une vue ArchiMate. " +
        "La relation ArchiMate sous-jacente n'est pas supprimée.",
      inputSchema: {
        view_id: z.string().describe("Identifiant de la vue"),
        connection_id: z
          .string()
          .describe("Identifiant de la connexion à supprimer"),
      },
    },
    async ({ view_id, connection_id }) => {
      await deleteViewConnection(
        await activeWorkspaceId(auth, "write"),
        view_id,
        connection_id
      )
      return toContent({ deleted: true, identifier: connection_id })
    }
  )

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
      const model = await loadModel(await activeWorkspaceId(auth, "read"))
      const view = model.views.find((v) => v.uuid === view_id)
      if (!view) throw new Error(`Vue '${view_id}' introuvable.`)
      const svg = renderViewToSvg(view, model)
      return {
        content: [
          {
            type: "image" as const,
            data: Buffer.from(svg).toString("base64"),
            mimeType: "image/svg+xml",
          },
        ],
      }
    }
  )
}
