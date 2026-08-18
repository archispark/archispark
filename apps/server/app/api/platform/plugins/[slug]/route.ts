import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { getPlatformPlugin, setPluginEnabled } from "@/lib/plugins/service"
import { parseBody } from "@/lib/archimate/validation"
import { PlatformPluginUpdateSchema } from "@/lib/archimate/platform-validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { slug } = await params
    return NextResponse.json(await getPlatformPlugin(slug))
  })
)

export const PUT = withErrorHandling(
  withSuperAdmin(async (req: NextRequest, _auth, { params }: Ctx) => {
    const body = parseBody(PlatformPluginUpdateSchema, await req.json())
    const { slug } = await params
    return NextResponse.json(await setPluginEnabled(slug, body.enabled))
  })
)
