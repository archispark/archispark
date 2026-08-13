import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import {
  getActivePlatformOrganization,
  exitPlatformOrganization,
} from "@/lib/archimate/platform-context-store"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withSuperAdmin(async (_req, auth) => {
    const organization = await getActivePlatformOrganization(auth.user.id)
    return NextResponse.json({ organization })
  })
)

export const DELETE = withErrorHandling(
  withSuperAdmin(async (_req, auth) => {
    await exitPlatformOrganization(auth.user.id)
    return new NextResponse(null, { status: 204 })
  })
)
