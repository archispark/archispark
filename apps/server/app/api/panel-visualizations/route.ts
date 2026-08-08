import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { NATIVE_PANEL_VISUALIZATIONS } from "@/lib/dashboards/native-visualizations"

export const dynamic = "force-dynamic"

/** Static catalogue of panel visualizations — no plugin system, so no organization scoping needed. */
export const GET = withErrorHandling(
  withAuth(async () => {
    return NextResponse.json({ visualizations: NATIVE_PANEL_VISUALIZATIONS })
  })
)
