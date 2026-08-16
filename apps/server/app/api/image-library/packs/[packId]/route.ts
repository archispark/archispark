import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { deleteCustomImagePack } from "@/lib/archimate/image-library-upload"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ packId: string }> }

export const DELETE = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { packId } = await params
    await deleteCustomImagePack(packId)
    return new NextResponse(null, { status: 204 })
  })
)
