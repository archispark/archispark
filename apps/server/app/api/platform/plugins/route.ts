import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { listPlatformPlugins } from "@/lib/plugins/service"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withSuperAdmin(async () => {
    return NextResponse.json(await listPlatformPlugins())
  })
)
