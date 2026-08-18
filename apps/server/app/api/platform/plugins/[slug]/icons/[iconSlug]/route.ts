import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { readIconSvg } from "@/lib/plugins/content"
import { NotFoundError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Ctx = { params: Promise<{ slug: string; iconSlug: string }> }

// platform_admin-only preview — unlike the public
// /api/plugins/:pluginSlug/icons/:iconSlug route, this one serves an icon
// regardless of whether its plugin is enabled, so an admin can browse a
// disabled plugin's content (see /platform/plugins/[slug]) before deciding
// to enable it.
export const GET = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { slug, iconSlug } = await params

    const svg = readIconSvg(slug, iconSlug)
    if (svg === null)
      throw new NotFoundError(`Icône '${iconSlug}' introuvable.`)

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=60, must-revalidate",
      },
    })
  })
)
