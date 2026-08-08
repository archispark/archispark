import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import {
  updateMemberRole,
  removeMember,
} from "@/lib/archimate/organizations-store"
import {
  parseBody,
  OrganizationMemberUpdateSchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; userId: string }> }

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(OrganizationMemberUpdateSchema, await req.json())
    const { id, userId } = await params
    return NextResponse.json(
      await updateMemberRole(auth.user, parseIntParam(id), userId, body.role)
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { id, userId } = await params
    await removeMember(auth.user, parseIntParam(id), userId)
    return new NextResponse(null, { status: 204 })
  })
)
