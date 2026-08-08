import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { getWorkspaces } from "@/lib/archimate/registry"
import { getModelInfo } from "@/lib/archimate/store"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const wsId = await activeWorkspaceId(auth, "read")
    const wsList = await getWorkspaces(auth.user)
    const active = wsList.find((w) => w.active)
    return NextResponse.json({
      ...(await getModelInfo(wsId)),
      workspace_id: active?.id ?? null,
      workspace_name: active?.name ?? null,
    })
  })
)
