/**
 * Builds a fresh MCP server (with all tools/prompts/resources registered) per
 * HTTP request — see `pages/api/mcp.ts`. A single `McpServer` can only be
 * connected to one transport at a time, so sharing one instance across
 * requests throws "Already connected to a transport".
 *
 * Every tool resolves the active workspace through the same authorization
 * gateway as the REST API (`lib/archimate/access.ts`), honouring the
 * caller's personal API token pinned organization/workspace scope.
 */

import packageJson from "../../package.json" with { type: "json" }
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { AuthContext } from "@/lib/archimate/access"
import { registerPromptsAndResources } from "./prompts-resources"
import { registerReadTools } from "./tools/read-tools"
import { registerViewTools } from "./tools/view-tools"
import { registerElementTools } from "./tools/element-tools"
import { registerRelationshipTools } from "./tools/relationship-tools"
import { registerWorkspaceTools } from "./tools/workspace-tools"
import { registerModelTools } from "./tools/model-tools"
import { registerPropertyDefinitionTools } from "./tools/property-definition-tools"

const { version } = packageJson

export function createMcpServer(auth: AuthContext): McpServer {
  const mcpServer = new McpServer({
    name: "ArchiSpark",
    version,
    description:
      "Serveur de modélisation ArchiMate 3.1 (spec The Open Group). " +
      "Gère des modèles d'architecture d'entreprise structurés en couches " +
      "(Motivation, Strategy, Business, Application, Technology, Physical, Implementation). " +
      "Tous les types d'éléments et de relations sont validés contre la taxonomie ArchiMate 3.1. " +
      "Avant de modéliser, utiliser le prompt 'archimate-modeling-guide' pour charger " +
      "les règles de modélisation et le workflow recommandé.",
  })

  registerPromptsAndResources(mcpServer)
  registerReadTools(mcpServer, auth)
  registerViewTools(mcpServer, auth)
  registerElementTools(mcpServer, auth)
  registerRelationshipTools(mcpServer, auth)
  registerWorkspaceTools(mcpServer, auth)
  registerModelTools(mcpServer, auth)
  registerPropertyDefinitionTools(mcpServer, auth)

  return mcpServer
}
