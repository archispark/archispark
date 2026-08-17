import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { readIconSvg } from "@/lib/plugins/content"
import { getEnabledPluginSlugs } from "@/lib/plugins/service"
import { NotFoundError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Ctx = { params: Promise<{ pluginSlug: string; iconSlug: string }> }

// Public — no auth, same policy as the old
// /api/image-library/items/:uuid/svg it replaces. 404 if the plugin is
// disabled, even though the icon slug is known — see
// app/api/platform/plugins/[slug]/icons/[iconSlug]/route.ts for the
// platform_admin-only variant that previews a disabled plugin's icons.
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: Ctx) => {
    const { pluginSlug, iconSlug } = await params

    const enabled = await getEnabledPluginSlugs()
    if (!enabled.has(pluginSlug))
      throw new NotFoundError(`Icône '${iconSlug}' introuvable.`)

    const svg = readIconSvg(pluginSlug, iconSlug)
    if (svg === null)
      throw new NotFoundError(`Icône '${iconSlug}' introuvable.`)

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    })
  }
)
