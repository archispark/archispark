import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { getElementViews } from "@/lib/archimate/store"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ element_id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { element_id } = await params
    return NextResponse.json(
      await getElementViews(await activeWorkspaceId(auth, "read"), element_id)
    )
  })
)
