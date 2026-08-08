import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { getInvitationPreview } from "@/lib/archimate/invitations-store"

export const dynamic = "force-dynamic"

// requireAuth still applies — an unauthenticated caller gets 401 before the
// token is ever examined (invitation acceptance is token-gated, not
// access.ts-gated — see invitations-store.ts's module doc).
export const GET = withErrorHandling(
  withAuth(
    async (
      _req: NextRequest,
      _auth,
      { params }: { params: Promise<{ token: string }> }
    ) => {
      const { token } = await params
      return NextResponse.json(await getInvitationPreview(token))
    }
  )
)
