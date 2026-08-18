import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { renameOrganization } from "@/lib/archimate/organizations-store"
import { parseBody, OrganizationUpdateSchema } from "@/lib/archimate/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const body = parseBody(OrganizationUpdateSchema, await req.json())
    const id = parseIntParam((await params).id)
    return NextResponse.json(await renameOrganization(auth.user, id, body))
  })
)
