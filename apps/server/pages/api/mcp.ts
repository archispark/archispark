/**
 * MCP endpoint — stateless streamable-HTTP transport.
 *
 * Pages Router (not App Router) is required here: the MCP SDK's
 * `StreamableHTTPServerTransport.handleRequest(req, res, body)` expects a
 * Node `http.IncomingMessage`/`ServerResponse`, which only `NextApiRequest`/
 * `NextApiResponse` expose — the App Router only has the Web `Request`/
 * `Response` types, with no official escape hatch to the raw Node objects.
 *
 * Each request gets a fresh server + transport with NO session id. This is
 * the robust pattern for serverless (Vercel): an in-memory session map can't
 * be shared across Lambda instances, so a client's follow-up request could
 * land on an instance that never saw its session. A stateless tool server
 * (no server->client streaming) doesn't need sessions, so we drop them
 * entirely.
 */

import type { NextApiRequest, NextApiResponse } from "next"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createMcpServer } from "@/lib/mcp/create-mcp-server"
import { lookupApiToken, tokenUserToContext } from "@/lib/archimate/auth"

// import_model transports the full Open Exchange XML as a JSON-RPC string
// argument — the Pages Router default (1mb) would silently truncate/reject
// any real-world model well before the REST /import route's 50mb ceiling.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
}

function methodNotAllowed(res: NextApiResponse): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed: this MCP server is stateless.",
    },
    id: null,
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, mcp-session-id, Authorization"
  )
  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  if (req.method !== "POST") {
    methodNotAllowed(res)
    return
  }

  const token = (req.headers.authorization ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim()
  if (!token) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Token requis." },
      id: null,
    })
    return
  }

  let auth: ReturnType<typeof tokenUserToContext>
  try {
    const tokenUser = await lookupApiToken(token)
    if (!tokenUser) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Token invalide." },
        id: null,
      })
      return
    }
    auth = tokenUserToContext(tokenUser)
  } catch {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Erreur d'authentification." },
      id: null,
    })
    return
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    res.on("close", () => {
      transport.close()
    })
    const mcpServer = createMcpServer(auth)
    await mcpServer.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error("[mcp] request failed:", err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      })
    }
  }
}
