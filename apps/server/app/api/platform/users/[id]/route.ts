import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import {
  getPlatformUser,
  updatePlatformUser,
} from "@/lib/archimate/platform-users-store"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformUserUpdateSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { id } = await params
    return NextResponse.json(await getPlatformUser(id))
  })
)

export const PUT = withErrorHandling(
  withSuperAdmin(async (req: NextRequest, _auth, { params }: Ctx) => {
    const body = parseBody(PlatformUserUpdateSchema, await req.json())
    const { id } = await params
    return NextResponse.json(await updatePlatformUser(id, body))
  })
)
