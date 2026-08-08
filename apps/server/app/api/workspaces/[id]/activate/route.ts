import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activateWorkspace } from "@/lib/archimate/registry"

export const dynamic = "force-dynamic"

export const POST = withErrorHandling(
  withAuth(
    async (
      _req: NextRequest,
      auth,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const { id } = await params
      return NextResponse.json(await activateWorkspace(auth.user, id))
    }
  )
)
