import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { VIEWPOINTS } from "@/lib/archimate/schemas"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async () => {
    return NextResponse.json([...VIEWPOINTS].sort((a, b) => a.localeCompare(b)))
  })
)
