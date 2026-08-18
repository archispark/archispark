import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import {
  listMembers,
  addMember,
} from "@/lib/archimate/organization-members-store"
import {
  parseBody,
  OrganizationMemberCreateSchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const id = parseIntParam((await params).id)
    return NextResponse.json(await listMembers(auth.user, id))
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(OrganizationMemberCreateSchema, await req.json())
    const id = parseIntParam((await params).id)
    return NextResponse.json(
      await addMember(auth.user, id, body.username, body.role),
      { status: 201 }
    )
  })
)
