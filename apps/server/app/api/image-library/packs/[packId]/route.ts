import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { deleteCustomImagePack } from "@/lib/archimate/image-library-upload"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ packId: string }> }

export const DELETE = withErrorHandling(
  withAuth(async (_req: NextRequest, auth, { params }: Ctx) => {
    const { packId } = await params
    const { organizationId } = await resolveActiveContext(
      auth.user,
      "write",
      auth.tokenContext
    )
    await deleteCustomImagePack(organizationId, packId)
    return new NextResponse(null, { status: 204 })
  })
)
