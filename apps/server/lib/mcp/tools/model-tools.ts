import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { exportModelToXml, importModelFromXml } from "@/lib/archimate/store"
import { VIEWPOINTS } from "@/lib/archimate/schemas"
import { toContent } from "./shared"

export function registerModelTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
  mcpServer.registerTool(
    "export_model",
    {
      description:
        "Exporte le modèle ArchiMate actif au format Open Exchange XML (standard The Open Group). " +
        "Le XML peut être importé dans d'autres outils ArchiMate (Archi, etc.).",
      inputSchema: {},
    },
    async () => {
      const xml = await exportModelToXml(await activeWorkspaceId(auth, "read"))
      return { content: [{ type: "text" as const, text: xml }] }
    }
  )

  mcpServer.registerTool(
    "import_model",
    {
      description:
        "Importe un modèle ArchiMate depuis du XML au format Open Exchange (archimate3_Model.xsd). " +
        "ATTENTION: remplace intégralement le contenu du workspace actif. " +
        "Retourne les métadonnées du modèle importé.",
      inputSchema: {
        xml: z
          .string()
          .describe("Contenu XML au format Open Exchange ArchiMate 3.1"),
      },
    },
    async ({ xml }) => {
      return toContent(
        await importModelFromXml(await activeWorkspaceId(auth, "write"), xml)
      )
    }
  )

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
  )

  mcpServer.registerTool(
    "save_model",
    {
      description:
        "No-op kept for compatibility: every change is persisted to PostgreSQL immediately.",
      inputSchema: {},
    },
    async () => toContent({ saved: true, path: "postgres" })
  )
}
