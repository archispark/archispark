import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import {
  listAllOrganizations,
  createOrganization,
} from "@/lib/archimate/platform-store"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformOrganizationCreateSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withSuperAdmin(async () => {
    return NextResponse.json(await listAllOrganizations())
  })
)

export const POST = withErrorHandling(
  withSuperAdmin(async (req: NextRequest) => {
    const body = parseBody(PlatformOrganizationCreateSchema, await req.json())
    return NextResponse.json(await createOrganization(body), { status: 201 })
  })
)
