import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { addOrganizationMember } from "@/lib/archimate/platform-organization-members-store"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformOrganizationMemberAddSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling(
  withSuperAdmin(async (req: NextRequest, _auth, { params }: Ctx) => {
    const body = parseBody(
      PlatformOrganizationMemberAddSchema,
      await req.json()
    )
    const id = parseIntParam((await params).id)
    return NextResponse.json(
      await addOrganizationMember(id, body.user_id, body.role)
    )
  })
)
