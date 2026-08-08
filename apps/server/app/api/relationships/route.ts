import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { listRelationships, createRelationship } from "@/lib/archimate/store"
import {
  parseBody,
  RelationshipCreateSchema,
  RelationshipQuerySchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const q = parseBody(
      RelationshipQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams)
    )
    return NextResponse.json(
      await listRelationships(
        await activeWorkspaceId(auth, "read"),
        q.type ?? null,
        q.source_id ?? null,
        q.target_id ?? null
      )
    )
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(RelationshipCreateSchema, await req.json())
    return NextResponse.json(
      await createRelationship(await activeWorkspaceId(auth, "write"), body),
      { status: 201 }
    )
  })
)
