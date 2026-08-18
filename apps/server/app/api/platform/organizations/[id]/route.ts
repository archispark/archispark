import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import {
  getPlatformOrganization,
  updatePlatformOrganization,
  deleteOrganizationAsPlatformAdmin,
} from "@/lib/archimate/platform-store"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformOrganizationUpdateSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const id = parseIntParam((await params).id)
    return NextResponse.json(await getPlatformOrganization(id))
  })
)

export const PUT = withErrorHandling(
  withSuperAdmin(async (req: NextRequest, _auth, { params }: Ctx) => {
    const body = parseBody(PlatformOrganizationUpdateSchema, await req.json())
    const id = parseIntParam((await params).id)
    return NextResponse.json(await updatePlatformOrganization(id, body))
  })
)

export const DELETE = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const id = parseIntParam((await params).id)
    await deleteOrganizationAsPlatformAdmin(id)
    return new NextResponse(null, { status: 204 })
  })
)
