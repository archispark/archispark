import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import {
  getElementById,
  updateElement,
  deleteElement,
} from "@/lib/archimate/store"
import { parseBody, ElementUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ element_id: string }> }

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { element_id } = await params
    return NextResponse.json(
      await getElementById(await activeWorkspaceId(auth, "read"), element_id)
    )
  })
)

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(ElementUpdateSchema, await req.json())
    const { element_id } = await params
    return NextResponse.json(
      await updateElement(
        await activeWorkspaceId(auth, "write"),
        element_id,
        body
      )
    )
  })
)

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { element_id } = await params
    await deleteElement(await activeWorkspaceId(auth, "write"), element_id)
    return new NextResponse(null, { status: 204 })
  })
)
