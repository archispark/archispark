import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { updateViewNode, deleteViewNode } from "@/lib/archimate/store"
import { parseBody, NodeUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ view_id: string; node_id: string }> }

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(NodeUpdateSchema, await req.json())
    const { view_id, node_id } = await params
    return NextResponse.json(
      await updateViewNode(
        await activeWorkspaceId(auth, "write"),
        view_id,
        node_id,
        body
      )
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { view_id, node_id } = await params
    await deleteViewNode(
      await activeWorkspaceId(auth, "write"),
      view_id,
      node_id
    )
    return new NextResponse(null, { status: 204 })
  })
)
