import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import {
  listAllUsers,
  createPlatformUser,
} from "@/lib/archimate/platform-users-store"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformUserCreateSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withSuperAdmin(async () => {
    return NextResponse.json(await listAllUsers())
  })
)

export const POST = withErrorHandling(
  withSuperAdmin(async (req: NextRequest) => {
    const body = parseBody(PlatformUserCreateSchema, await req.json())
    return NextResponse.json(await createPlatformUser(body), { status: 201 })
  })
)
