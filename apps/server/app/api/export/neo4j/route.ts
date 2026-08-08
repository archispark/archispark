import { NextResponse, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db, organizations } from "@workspace/db"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { loadModel } from "@/lib/archimate/store"
import { NotFoundError } from "@/lib/archimate/errors"
import { importModelToNeo4j } from "@workspace/db-neo4j"

export const dynamic = "force-dynamic"

// Sync the current workspace model into Neo4j (wipe-and-reload scoped to this workspace's :Model subgraph),
// tagged with the workspace's organization (see @workspace/db-neo4j's Organization node / organizationId tenant tag)
export const POST = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const ctx = await resolveActiveContext(auth.user, "read", auth.tokenContext)
    const [org] = await db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
      })
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
    if (!org) throw new NotFoundError("Organisation introuvable.")

    const model = await loadModel(ctx.workspaceId)
    return NextResponse.json(await importModelToNeo4j(model, org))
  })
)
