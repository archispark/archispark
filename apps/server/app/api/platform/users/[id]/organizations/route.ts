import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { addUserToOrganization } from "@/lib/archimate/platform-user-organizations-store"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformUserOrganizationAddSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling(
  withSuperAdmin(async (req: NextRequest, _auth, { params }: Ctx) => {
    const body = parseBody(PlatformUserOrganizationAddSchema, await req.json())
    const { id } = await params
    const organizationId = parseIntParam(body.organization_id)
    return NextResponse.json(
      await addUserToOrganization(id, organizationId, body.role)
    )
  })
)
