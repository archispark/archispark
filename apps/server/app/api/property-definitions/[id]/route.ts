import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  getPropertyDefinitionById,
  updatePropertyDefinition,
  deletePropertyDefinition,
} from "@/lib/archimate/store"
import {
  parseBody,
  PropertyDefinitionUpdateSchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { id } = await params
    return NextResponse.json(
      await getPropertyDefinitionById(await activeWorkspaceId(auth, "read"), id)
    )
  })
)

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(PropertyDefinitionUpdateSchema, await req.json())
    const { id } = await params
    return NextResponse.json(
      await updatePropertyDefinition(
        await activeWorkspaceId(auth, "write"),
        id,
        body
      )
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { id } = await params
    await deletePropertyDefinition(await activeWorkspaceId(auth, "write"), id)
    return new NextResponse(null, { status: 204 })
  })
)
