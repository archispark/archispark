import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { loadModel } from "@/lib/archimate/store"
import { importModelToNeo4j } from "@workspace/db-neo4j"

export const dynamic = "force-dynamic"

// Sync the current workspace model into Neo4j (wipe-and-reload scoped to this workspace's :Model subgraph)
export const POST = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const model = await loadModel(await activeWorkspaceId(auth, "read"))
    return NextResponse.json(await importModelToNeo4j(model))
  })
)
