import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { activateOrganization } from "@/lib/archimate/organizations-store"

export const dynamic = "force-dynamic"

export const POST = withErrorHandling(
  withAuth(
    async (
      _req: NextRequest,
      auth,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const id = parseIntParam((await params).id)
      return NextResponse.json(await activateOrganization(auth.user, id))
    }
  )
)
