import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { removeOrganizationMember } from "@/lib/archimate/platform-organization-members-store"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; userId: string }> }

export const DELETE = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { id, userId } = await params
    await removeOrganizationMember(parseIntParam(id), userId)
    return new NextResponse(null, { status: 204 })
  })
)
