import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { getRelationshipViews } from "@/lib/archimate/store"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ relationship_id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { relationship_id } = await params
    return NextResponse.json(
      await getRelationshipViews(
        await activeWorkspaceId(auth, "read"),
        relationship_id
      )
    )
  })
)
