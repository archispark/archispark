import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { listOrganizationsForUser } from "@/lib/archimate/organizations-store"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    return NextResponse.json(await listOrganizationsForUser(auth.user))
  })
)
