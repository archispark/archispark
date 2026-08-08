import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { listViews, createView } from "@/lib/archimate/store"
import { parseBody, ViewCreateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    return NextResponse.json(
      await listViews(await activeWorkspaceId(auth, "read"))
    )
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(ViewCreateSchema, await req.json())
    return NextResponse.json(
      await createView(await activeWorkspaceId(auth, "write"), body),
      { status: 201 }
    )
  })
)
