import { describe, it, expect, vi } from "vitest"
import type { NextApiRequest, NextApiResponse } from "next"

vi.mock("@/lib/archimate/auth", () => ({
  lookupApiToken: vi.fn(),
  tokenUserToContext: vi.fn((u: unknown) => ({ user: u, tokenContext: null })),
}))

vi.mock("@/lib/mcp/create-mcp-server", () => ({
  createMcpServer: vi.fn(() => ({ connect: vi.fn(async () => undefined) })),
}))

const handleRequest = vi.fn(async (_req: unknown, res: NextApiResponse) => {
  res.status(200).json({ jsonrpc: "2.0", id: 1, result: {} })
})

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this: any
  ) {
    this.handleRequest = handleRequest
    this.close = vi.fn()
  }),
}))

// The route lives under pages/api/mcp.ts: Next.js's Pages Router treats
// *every* file in pages/api/ as a route, so a colocated `*.test.ts` there
// would itself become a live "/api/mcp.test" endpoint at build time. Keeping
// the test here (under lib/mcp/, importing the route module directly) avoids
// that trap.
const handler = (await import("@/pages/api/mcp")).default
const { lookupApiToken } = await import("@/lib/archimate/auth")
const { createMcpServer } = await import("@/lib/mcp/create-mcp-server")

const TEST_TOKEN = "test-mcp-bearer-token"

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: "POST",
    headers: {},
    body: { method: "initialize", params: {} },
    ...overrides,
  } as NextApiRequest
}

function makeRes() {
  const state = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    jsonBody: undefined as unknown,
    ended: false,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {
    setHeader: (k: string, v: string) => {
      state.headers[k] = v
    },
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(body: unknown) {
      state.jsonBody = body
      return res
    },
    end() {
      state.ended = true
      return res
    },
    on: vi.fn(),
  }
  Object.defineProperty(res, "headersSent", {
    get: () => state.jsonBody !== undefined || state.ended,
  })
  return { res: res as NextApiResponse, state }
}

describe("pages/api/mcp", () => {
  it("responds 204 with CORS headers to OPTIONS", async () => {
    const { res, state } = makeRes()
    await handler(makeReq({ method: "OPTIONS" }), res)
    expect(state.statusCode).toBe(204)
    expect(state.headers["Access-Control-Allow-Origin"]).toBe("*")
    expect(state.headers["Access-Control-Allow-Headers"]).toContain(
      "mcp-session-id"
    )
  })

  it("returns 405 for GET (stateless server)", async () => {
    const { res, state } = makeRes()
    await handler(makeReq({ method: "GET" }), res)
    expect(state.statusCode).toBe(405)
    expect(
      (state.jsonBody as { error: { message: string } }).error.message
    ).toMatch(/stateless/i)
  })

  it("returns 405 for DELETE (stateless server)", async () => {
    const { res, state } = makeRes()
    await handler(makeReq({ method: "DELETE" }), res)
    expect(state.statusCode).toBe(405)
  })

  it("returns 401 when Authorization header is absent", async () => {
    const { res, state } = makeRes()
    await handler(makeReq(), res)
    expect(state.statusCode).toBe(401)
    expect(
      (state.jsonBody as { error: { message: string } }).error.message
    ).toMatch(/requis/i)
  })

  it("returns 401 when the token is invalid", async () => {
    vi.mocked(lookupApiToken).mockResolvedValueOnce(null)
    const { res, state } = makeRes()
    await handler(
      makeReq({ headers: { authorization: `Bearer ${TEST_TOKEN}` } }),
      res
    )
    expect(state.statusCode).toBe(401)
    expect(
      (state.jsonBody as { error: { message: string } }).error.message
    ).toMatch(/invalide/i)
  })

  it("returns 401 when token lookup throws", async () => {
    vi.mocked(lookupApiToken).mockRejectedValueOnce(new Error("db error"))
    const { res, state } = makeRes()
    await handler(
      makeReq({ headers: { authorization: `Bearer ${TEST_TOKEN}` } }),
      res
    )
    expect(state.statusCode).toBe(401)
    expect(
      (state.jsonBody as { error: { message: string } }).error.message
    ).toMatch(/authentification/i)
  })

  it("builds a fresh MCP server and forwards the request on success", async () => {
    vi.mocked(lookupApiToken).mockResolvedValueOnce({
      id: "user-admin",
      username: "admin",
      role: "user",
      organizationId: 1,
      workspaceId: null,
    })
    const { res, state } = makeRes()
    await handler(
      makeReq({ headers: { authorization: `Bearer ${TEST_TOKEN}` } }),
      res
    )
    expect(vi.mocked(createMcpServer)).toHaveBeenCalled()
    expect(handleRequest).toHaveBeenCalled()
    expect(state.statusCode).toBe(200)
  })

  it("returns 500 when the transport throws and headers were not sent", async () => {
    vi.mocked(lookupApiToken).mockResolvedValueOnce({
      id: "user-admin",
      username: "admin",
      role: "user",
      organizationId: 1,
      workspaceId: null,
    })
    handleRequest.mockRejectedValueOnce(new Error("transport crash"))
    const { res, state } = makeRes()
    await handler(
      makeReq({ headers: { authorization: `Bearer ${TEST_TOKEN}` } }),
      res
    )
    expect(state.statusCode).toBe(500)
  })
})
