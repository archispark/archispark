import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { updateWorkspace, deleteWorkspace } from "@/lib/archimate/registry"
import { parseBody, WorkspaceUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(WorkspaceUpdateSchema, await req.json())
    const { id } = await params
    return NextResponse.json(
      await updateWorkspace(auth.user, id, body.name, body.description)
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { id } = await params
    await deleteWorkspace(auth.user, id)
    return new NextResponse(null, { status: 204 })
  })
)
