import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

vi.mock("@workspace/db", () => ({
  truncateApplicationTables: vi.fn(),
  seedLocalDemoUsers: vi.fn(),
  seedDemoWorkspaces: vi.fn(),
  findLocalUserIdByUsername: vi.fn(),
  seedDashboardsForAllWorkspaces: vi.fn(),
}))
vi.mock("@workspace/db-neo4j", () => ({
  resetGraphData: vi.fn(),
  importAllWorkspacesToNeo4j: vi.fn(),
}))

import {
  truncateApplicationTables,
  seedLocalDemoUsers,
  seedDemoWorkspaces,
  findLocalUserIdByUsername,
  seedDashboardsForAllWorkspaces,
} from "@workspace/db"
import { resetGraphData, importAllWorkspacesToNeo4j } from "@workspace/db-neo4j"

function makeReq(authorization?: string): NextRequest {
  return new NextRequest("http://localhost:8000/api/cron/reset-demo", {
    headers: authorization ? { authorization } : {},
  })
}

describe("GET /api/cron/reset-demo", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("returns 404 when DEMO_RESET_ENABLED is unset, even with a valid secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")
    const res = await GET(makeReq("Bearer s3cret"))
    expect(res.status).toBe(404)
    expect(truncateApplicationTables).not.toHaveBeenCalled()
  })

  it("returns 404 when DEMO_RESET_ENABLED is true but the secret is missing or wrong", async () => {
    vi.stubEnv("DEMO_RESET_ENABLED", "true")
    vi.stubEnv("CRON_SECRET", "s3cret")

    const missing = await GET(makeReq())
    expect(missing.status).toBe(404)

    const wrong = await GET(makeReq("Bearer wrong"))
    expect(wrong.status).toBe(404)

    expect(truncateApplicationTables).not.toHaveBeenCalled()
  })

  it("runs the full reset-and-reseed sequence and returns a 200 summary when both gates pass", async () => {
    vi.stubEnv("DEMO_RESET_ENABLED", "true")
    vi.stubEnv("CRON_SECRET", "s3cret")

    vi.mocked(truncateApplicationTables).mockResolvedValue({ tables: 12 })
    vi.mocked(resetGraphData).mockResolvedValue({ deleted: 34 })
    vi.mocked(seedLocalDemoUsers).mockResolvedValue([
      { username: "admin", id: "local:1", created: true },
    ])
    vi.mocked(findLocalUserIdByUsername).mockResolvedValue("local:archi")
    const orgIdByWorkspace = new Map([
      ["ArchiSurance", 1],
      ["ArchiMetal", 1],
      ["Open Day", 2],
    ])
    vi.mocked(seedDemoWorkspaces).mockResolvedValue({ orgIdByWorkspace })
    vi.mocked(seedDashboardsForAllWorkspaces).mockResolvedValue({
      seededRevisions: 12,
      workspaces: 3,
    })
    vi.mocked(importAllWorkspacesToNeo4j).mockResolvedValue({
      imported: ["ArchiSurance", "ArchiMetal", "Open Day"],
      failed: [],
    })

    const res = await GET(makeReq("Bearer s3cret"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.tables).toEqual({ tables: 12 })
    expect(body.graph).toEqual({ deleted: 34 })
    expect(body.users).toBe(1)
    expect(body.workspaces.sort()).toEqual(
      ["ArchiSurance", "ArchiMetal", "Open Day"].sort()
    )

    const order = [
      truncateApplicationTables,
      resetGraphData,
      seedLocalDemoUsers,
      seedDemoWorkspaces,
      seedDashboardsForAllWorkspaces,
      importAllWorkspacesToNeo4j,
    ].map((fn) => vi.mocked(fn).mock.invocationCallOrder[0])
    expect(order).toEqual([...order].sort((a, b) => a! - b!))
  })

  it("returns 500 and logs the real error when a step throws", async () => {
    vi.stubEnv("DEMO_RESET_ENABLED", "true")
    vi.stubEnv("CRON_SECRET", "s3cret")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const boom = new Error("boom")
    vi.mocked(truncateApplicationTables).mockRejectedValue(boom)

    const res = await GET(makeReq("Bearer s3cret"))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(consoleError).toHaveBeenCalledWith("Demo reset cron failed:", boom)
  })
})
