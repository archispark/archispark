import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import {
  parseBody,
  OrganizationInvitationResendSchema,
} from "@/lib/archimate/validation"
import { resendInvitation } from "@/lib/archimate/invitations-store"

export const dynamic = "force-dynamic"

export const POST = withErrorHandling(
  withAuth(
    async (
      req: NextRequest,
      auth,
      { params }: { params: Promise<{ id: string; invitationId: string }> }
    ) => {
      const { id, invitationId } = await params
      const body = parseBody(
        OrganizationInvitationResendSchema,
        await req.json()
      )
      return NextResponse.json(
        await resendInvitation(
          auth.user,
          parseIntParam(id),
          parseIntParam(invitationId),
          body.delivery_mode
        ),
        { status: 201 }
      )
    }
  )
)
