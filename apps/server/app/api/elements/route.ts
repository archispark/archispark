import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { listElements, createElement } from "@/lib/archimate/store"
import {
  parseBody,
  ElementCreateSchema,
  ElementQuerySchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const q = parseBody(
      ElementQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams)
    )
    return NextResponse.json(
      await listElements(
        await activeWorkspaceId(auth, "read"),
        q.type ?? null,
        q.name ?? null
      )
    )
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(ElementCreateSchema, await req.json())
    return NextResponse.json(
      await createElement(await activeWorkspaceId(auth, "write"), body),
      { status: 201 }
    )
  })
)
