import { NextResponse, type NextRequest } from "next/server"
import {
  truncateApplicationTables,
  seedLocalDemoUsers,
  seedDemoWorkspaces,
  findLocalUserIdByUsername,
  seedSystemDashboards,
} from "@workspace/db"
import { resetGraphData, importAllWorkspacesToNeo4j } from "@workspace/db-neo4j"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

async function runStep<T>(name: string, action: () => Promise<T>): Promise<T> {
  const startedAt = Date.now()
  console.info("Demo reset cron step started", { name })
  try {
    const result = await action()
    console.info("Demo reset cron step completed", {
      name,
      durationMs: Date.now() - startedAt,
    })
    return result
  } catch (err) {
    console.error("Demo reset cron step failed", {
      name,
      durationMs: Date.now() - startedAt,
      err,
    })
    throw err
  }
}

// Vercel Cron replacement for the old `seed-demo.yml` GitHub Action:
// full fresh-reinstall-style reset (every application table + the whole
// Neo4j graph, schema/migration history preserved) followed by a reseed of
// the demo accounts/organizations/workspaces/dashboards — the public demo
// lets visitors create their own accounts/organizations/workspaces, so a
// scoped delete of just the 3 demo workspaces would leave that behind.
//
// Gated by two independent checks: `DEMO_RESET_ENABLED` must be `"true"`
// (never set outside the actual demo Vercel project — apps/server/vercel.json's
// `crons` entry is committed and therefore inherited by any fork/deployment
// of this codebase) and a valid `CRON_SECRET` bearer token (which Vercel
// attaches automatically to its own cron invocations once the env var is
// set on the project). Both failures return 404 rather than 401/403, so a
// deployment where this route isn't meant to be active doesn't confirm its
// existence to a prober.
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env["DEMO_RESET_ENABLED"] !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const cronSecret = process.env["CRON_SECRET"]
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const startedAt = Date.now()
    const tables = await runStep(
      "truncate PostgreSQL",
      truncateApplicationTables
    )
    const graph = await runStep("reset Neo4j", resetGraphData)
    const users = await runStep("seed demo users", seedLocalDemoUsers)
    const { orgIdByWorkspace } = await runStep("seed demo workspaces", () =>
      seedDemoWorkspaces(async (username) => {
        const id = await findLocalUserIdByUsername(username)
        if (!id) {
          throw new Error(
            `Demo user "${username}" introuvable après seedLocalDemoUsers`
          )
        }
        return id
      })
    )
    const dashboards = await runStep("seed dashboards", seedSystemDashboards)
    const neo4j = await runStep(
      "import workspaces into Neo4j",
      importAllWorkspacesToNeo4j
    )

    return NextResponse.json({
      ok: true,
      resetAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      tables,
      graph,
      workspaces: [...orgIdByWorkspace.keys()],
      users: users.length,
      dashboards,
      neo4j,
    })
  } catch (err) {
    console.error("Demo reset cron failed:", err)
    return NextResponse.json(
      { ok: false, error: "Demo reset failed." },
      { status: 500 }
    )
  }
}
