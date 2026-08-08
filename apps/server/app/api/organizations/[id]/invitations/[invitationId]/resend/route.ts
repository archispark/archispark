import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { resendInvitation } from "@/lib/archimate/invitations-store"

export const dynamic = "force-dynamic"

export const POST = withErrorHandling(
  withAuth(
    async (
      _req: NextRequest,
      auth,
      { params }: { params: Promise<{ id: string; invitationId: string }> }
    ) => {
      const { id, invitationId } = await params
      return NextResponse.json(
        await resendInvitation(
          auth.user,
          parseIntParam(id),
          parseIntParam(invitationId)
        ),
        { status: 201 }
      )
    }
  )
)
