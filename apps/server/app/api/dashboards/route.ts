import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { parseBody } from "@/lib/archimate/validation"
import { ValidationError } from "@/lib/archimate/errors"
import { dashboardDefinitionSchema } from "@/lib/dashboards/contracts"
import { assertDashboardQueriesSafe } from "@/lib/dashboards/datasource-executors"
import { createRevision, listLatestRevisions } from "@/lib/dashboards/repository"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const { organizationId } = await resolveActiveContext(auth.user, "read", auth.tokenContext)
    return NextResponse.json(await listLatestRevisions(organizationId))
  })
)

/** Creates a new dashboard (revision 1). `createdAt`/`updatedAt`/`createdBy`/`updatedBy` are server-authoritative — any value sent by the client is overwritten. */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const { organizationId } = await resolveActiveContext(auth.user, "write", auth.tokenContext)
    const raw = (await req.json()) as Record<string, unknown>
    const now = new Date().toISOString()
    const definition = parseBody(dashboardDefinitionSchema, {
      ...raw,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.user.username,
      updatedBy: auth.user.username,
    })
    try {
      assertDashboardQueriesSafe(definition)
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : String(error))
    }
    const revision = await createRevision(organizationId, definition.id, definition, auth.user.id)
    return NextResponse.json(revision, { status: 201 })
  })
)
