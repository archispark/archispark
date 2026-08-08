import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { getWorkspaces, createWorkspace } from "@/lib/archimate/registry"
import { parseBody, WorkspaceCreateSchema } from "@/lib/archimate/validation"
import { ValidationError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    return NextResponse.json(await getWorkspaces(auth.user))
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(WorkspaceCreateSchema, await req.json())
    const organizationId =
      body.organization_id !== undefined
        ? parseInt(body.organization_id, 10)
        : undefined
    if (organizationId !== undefined && !Number.isFinite(organizationId))
      throw new ValidationError("organization_id invalide.")
    return NextResponse.json(
      await createWorkspace(
        auth.user,
        body.name,
        body.path,
        body.description,
        organizationId
      ),
      { status: 201 }
    )
  })
)
