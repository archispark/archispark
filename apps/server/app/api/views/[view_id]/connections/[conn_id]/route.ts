import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  updateViewConnection,
  deleteViewConnection,
} from "@/lib/archimate/store"
import { parseBody, ConnectionUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ view_id: string; conn_id: string }> }

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(ConnectionUpdateSchema, await req.json())
    const { view_id, conn_id } = await params
    return NextResponse.json(
      await updateViewConnection(
        await activeWorkspaceId(auth, "write"),
        view_id,
        conn_id,
        body
      )
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { view_id, conn_id } = await params
    await deleteViewConnection(
      await activeWorkspaceId(auth, "write"),
      view_id,
      conn_id
    )
    return new NextResponse(null, { status: 204 })
  })
)
