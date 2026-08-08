import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { acceptInvitation } from "@/lib/archimate/invitations-store"

export const dynamic = "force-dynamic"

export const POST = withErrorHandling(
  withAuth(
    async (
      _req: NextRequest,
      auth,
      { params }: { params: Promise<{ token: string }> }
    ) => {
      const { token } = await params
      return NextResponse.json(await acceptInvitation(auth.user, token))
    }
  )
)
