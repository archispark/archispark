import { NextResponse } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { listEnabledPluginsWithIcons } from "@/lib/plugins/service"

export const dynamic = "force-dynamic"

// Every authenticated user — enabled plugins with their icons, for the icon
// picker (see components/image-picker.tsx).
export const GET = withErrorHandling(
  withAuth(async () => {
    return NextResponse.json(await listEnabledPluginsWithIcons())
  })
)
