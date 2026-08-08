import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { loadModel } from "@/lib/archimate/store"
import { serializeToOpenExchange } from "@/lib/archimate/oxf-serializer"

export const dynamic = "force-dynamic"

// Export model as XML
export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const model = await loadModel(await activeWorkspaceId(auth, "read"))
    const xml = serializeToOpenExchange(model)
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${model.name || "model"}.xml"`,
      },
    })
  })
)
