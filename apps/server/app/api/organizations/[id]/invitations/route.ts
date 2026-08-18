import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import {
  listInvitations,
  createOrReplaceInvitation,
} from "@/lib/archimate/invitations-store"
import {
  parseBody,
  OrganizationInvitationCreateSchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const id = parseIntParam((await params).id)
    return NextResponse.json(await listInvitations(auth.user, id))
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(OrganizationInvitationCreateSchema, await req.json())
    const id = parseIntParam((await params).id)
    return NextResponse.json(
      await createOrReplaceInvitation(
        auth.user,
        id,
        body.email,
        body.role,
        body.delivery_mode
      ),
      {
        status: 201,
      }
    )
  })
)
