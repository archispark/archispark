import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
} from "@/lib/archimate/store"
import { parseBody, RelationshipUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ relationship_id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { relationship_id } = await params
    return NextResponse.json(
      await getRelationshipById(
        await activeWorkspaceId(auth, "read"),
        relationship_id
      )
    )
  })
)

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(RelationshipUpdateSchema, await req.json())
    const { relationship_id } = await params
    return NextResponse.json(
      await updateRelationship(
        await activeWorkspaceId(auth, "write"),
        relationship_id,
        body
      )
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { relationship_id } = await params
    await deleteRelationship(
      await activeWorkspaceId(auth, "write"),
      relationship_id
    )
    return new NextResponse(null, { status: 204 })
  })
)
