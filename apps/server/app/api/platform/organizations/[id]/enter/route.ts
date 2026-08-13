import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { enterOrganizationAsPlatformAdmin } from "@/lib/archimate/platform-context-store"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, auth, { params }: Ctx) => {
    const id = parseIntParam((await params).id)
    return NextResponse.json(
      await enterOrganizationAsPlatformAdmin(auth.user, id)
    )
  })
)
