import { vi } from "vitest"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * A minimal stand-in for `McpServer` that just captures registered
 * tool/prompt/resource handlers into maps, so tests can call them directly
 * instead of going through the real MCP SDK transport.
 */
export function createFakeMcpServer(): {
  mcpServer: McpServer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolHandlers: Map<string, (args: any) => Promise<unknown>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptHandlers: Map<string, (args: any) => Promise<unknown>>
  resourceHandlers: Map<string, () => Promise<unknown>>
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolHandlers = new Map<string, (args: any) => Promise<unknown>>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promptHandlers = new Map<string, (args: any) => Promise<unknown>>()
  const resourceHandlers = new Map<string, () => Promise<unknown>>()

  const mcpServer = {
    registerTool: vi.fn(
      (
        name: string,
        _schema: unknown,
        handler: (args: unknown) => Promise<unknown>
      ) => {
        toolHandlers.set(name, handler)
      }
    ),
    registerPrompt: vi.fn(
      (
        name: string,
        _schema: unknown,
        handler: (args: unknown) => Promise<unknown>
      ) => {
        promptHandlers.set(name, handler)
      }
    ),
    registerResource: vi.fn(
      (
        name: string,
        _uri: string,
        _meta: unknown,
        handler: () => Promise<unknown>
      ) => {
        resourceHandlers.set(name, handler)
      }
    ),
  } as unknown as McpServer

  return { mcpServer, toolHandlers, promptHandlers, resourceHandlers }
}

export const TEST_AUTH = {
  user: { id: "user-admin", username: "admin", role: "user" },
  tokenContext: { organizationId: 1, workspaceId: null },
}
