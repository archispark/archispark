import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import {
  listOrganizationsForUser,
  createOrganization,
} from "@/lib/archimate/organizations-store"
import {
  parseBody,
  OrganizationCreateSchema,
} from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    return NextResponse.json(await listOrganizationsForUser(auth.user))
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(OrganizationCreateSchema, await req.json())
    return NextResponse.json(await createOrganization(auth.user, body.name), {
      status: 201,
    })
  })
)
