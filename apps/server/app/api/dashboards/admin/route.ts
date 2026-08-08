import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { listForAdministration } from "@/lib/dashboards/repository"

export const dynamic = "force-dynamic"

/** Administration view: includes soft-deleted dashboards and the provisioned flag. Write intent — same owner/admin gate as editing a dashboard. */
export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const { workspaceId } = await resolveActiveContext(auth.user, "write", auth.tokenContext)
    return NextResponse.json(await listForAdministration(workspaceId))
  })
)
