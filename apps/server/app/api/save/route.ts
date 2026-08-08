import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"

export const dynamic = "force-dynamic"

// Persistence is immediate (every write hits Postgres); /save is a no-op kept
// for backwards compatibility with existing clients.
export const POST = withErrorHandling(
  withAuth(async () => {
    return NextResponse.json({ saved: true, path: "postgres" })
  })
)
