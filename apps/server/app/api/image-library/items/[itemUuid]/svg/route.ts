import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { getSystemInlineSvgItem } from "@/lib/archimate/image-library-store"
import { NotFoundError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ itemUuid: string }> }

// Public — serves a system-pack icon's inline SVG. No auth: these are
// generic ArchiMate notation pictograms, not organization data.
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: Ctx) => {
    const { itemUuid } = await params
    const svg = await getSystemInlineSvgItem(itemUuid)
    if (svg === null) throw new NotFoundError(`Image '${itemUuid}' introuvable.`)
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // Not immutable: system-pack items keep a stable uuid while their
        // svg_content can be updated in place (see
        // apps/server/scripts/generate-archimate-icon-pack.ts) — an
        // immutable/long-lived cache would hide those updates from clients
        // indefinitely.
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    })
  }
)
