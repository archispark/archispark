import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { getViewById, updateView, deleteView } from "@/lib/archimate/store"
import { parseBody, ViewUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ view_id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { view_id } = await params
    return NextResponse.json(
      await getViewById(await activeWorkspaceId(auth, "read"), view_id)
    )
  })
)

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(ViewUpdateSchema, await req.json())
    const { view_id } = await params
    return NextResponse.json(
      await updateView(await activeWorkspaceId(auth, "write"), view_id, body)
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { view_id } = await params
    await deleteView(await activeWorkspaceId(auth, "write"), view_id)
    return new NextResponse(null, { status: 204 })
  })
)
