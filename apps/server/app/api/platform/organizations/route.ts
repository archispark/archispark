import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { listAllOrganizations } from "@/lib/archimate/platform-store"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withSuperAdmin(async () => {
    return NextResponse.json(await listAllOrganizations())
  })
)
