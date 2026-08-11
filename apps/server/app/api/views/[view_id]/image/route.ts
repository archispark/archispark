import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { loadModel } from "@/lib/archimate/store"
import { renderViewToSvg } from "@/lib/archimate/renderer"
import { resolveElementImages } from "@/lib/archimate/image-library-resolve"
import { NotFoundError, ValidationError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ view_id: string }> }

export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const format = req.nextUrl.searchParams.get("format") || "svg"
    if (format !== "svg")
      throw new ValidationError(
        "Format invalide. Seul 'svg' est supporté côté serveur (l'export PNG se fait côté client)."
      )
    const { view_id } = await params
    const wsId = await activeWorkspaceId(auth, "read")
    const model = await loadModel(wsId)
    const view = model.views.find((v) => v.uuid === view_id)
    if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`)
    const elementImages = await resolveElementImages(model, wsId)
    const svg = renderViewToSvg(view, model, elementImages)
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
    })
  })
)
