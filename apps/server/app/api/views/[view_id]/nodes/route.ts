import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { createNode } from "@/lib/archimate/store"
import { parseBody, NodeCreateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ view_id: string }> }

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(NodeCreateSchema, await req.json())
    const { view_id } = await params
    return NextResponse.json(
      await createNode(await activeWorkspaceId(auth, "write"), view_id, body),
      { status: 201 }
    )
  })
)
