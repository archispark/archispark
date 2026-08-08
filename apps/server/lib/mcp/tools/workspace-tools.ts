import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { getWorkspaces, activateWorkspace } from "@/lib/archimate/registry"
import { toContent } from "./shared"

export function registerWorkspaceTools(
  mcpServer: McpServer,
  auth: AuthContext
): void {
  mcpServer.registerTool(
    "list_workspaces",
    {
      description:
        "Liste tous les workspaces disponibles et indique lequel est actif. " +
        "Chaque workspace est un modèle ArchiMate indépendant. " +
        "Utiliser activate_workspace pour changer de contexte.",
      inputSchema: {},
    },
    async () => toContent(await getWorkspaces(auth.user))
  )

  mcpServer.registerTool(
    "activate_workspace",
    {
      description:
        "Active un workspace par son identifiant. " +
        "Toutes les opérations suivantes (éléments, relations, vues) portent sur ce workspace. " +
        "L'identifiant est le champ 'id' retourné par list_workspaces.",
      inputSchema: {
        workspace_id: z
          .string()
          .describe(
            "Identifiant numérique du workspace (champ 'id' de list_workspaces)"
          ),
      },
    },
    async ({ workspace_id }) => {
      return toContent(await activateWorkspace(auth.user, workspace_id))
    }
  )
}
