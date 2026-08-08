import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { parseBody } from "@/lib/archimate/validation"
import { NotFoundError, ValidationError } from "@/lib/archimate/errors"
import { dashboardDefinitionSchema } from "@/lib/dashboards/contracts"
import { assertDashboardQueriesSafe } from "@/lib/dashboards/datasource-executors"
import { createRevision, deleteDashboard, getLatestRevision } from "@/lib/dashboards/repository"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ dashboardId: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { organizationId } = await resolveActiveContext(auth.user, "read", auth.tokenContext)
    const { dashboardId } = await params
    const revision = await getLatestRevision(organizationId, dashboardId)
    if (!revision) throw new NotFoundError(`Dashboard introuvable : ${dashboardId}`)
    return NextResponse.json(revision)
  })
)

/** Creates a new revision of an existing dashboard. Preserves the original `createdAt`/`createdBy` from the current latest revision; `updatedAt`/`updatedBy` are set to the acting user. */
export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const { organizationId } = await resolveActiveContext(auth.user, "write", auth.tokenContext)
    const { dashboardId } = await params
    const existing = await getLatestRevision(organizationId, dashboardId)
    if (!existing) throw new NotFoundError(`Dashboard introuvable : ${dashboardId}`)
    const raw = (await req.json()) as Record<string, unknown>
    const definition = parseBody(dashboardDefinitionSchema, {
      ...raw,
      id: dashboardId,
      createdAt: existing.definition.createdAt,
      createdBy: existing.definition.createdBy,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.user.username,
    })
    try {
      assertDashboardQueriesSafe(definition)
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : String(error))
    }
    const revision = await createRevision(organizationId, dashboardId, definition, auth.user.id)
    return NextResponse.json(revision)
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { organizationId } = await resolveActiveContext(auth.user, "write", auth.tokenContext)
    const { dashboardId } = await params
    await deleteDashboard(organizationId, dashboardId)
    return new NextResponse(null, { status: 204 })
  })
)
