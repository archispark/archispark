import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { removeUserFromOrganization } from "@/lib/archimate/platform-user-organizations-store"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; orgId: string }> }

export const DELETE = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { id, orgId } = await params
    await removeUserFromOrganization(id, parseIntParam(orgId))
    return new NextResponse(null, { status: 204 })
  })
)
