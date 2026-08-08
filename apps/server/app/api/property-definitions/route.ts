import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  listPropertyDefinitions,
  createPropertyDefinition,
} from "@/lib/archimate/store"
import {
  parseBody,
  PropertyDefinitionCreateSchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    return NextResponse.json(
      await listPropertyDefinitions(await activeWorkspaceId(auth, "read"))
    )
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(PropertyDefinitionCreateSchema, await req.json())
    return NextResponse.json(
      await createPropertyDefinition(
        await activeWorkspaceId(auth, "write"),
        body
      ),
      { status: 201 }
    )
  })
)
