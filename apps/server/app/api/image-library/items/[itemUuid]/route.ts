import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { deleteImagePackItem } from "@/lib/archimate/image-library-upload"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ itemUuid: string }> }

export const DELETE = withErrorHandling(
  withSuperAdmin(async (_req: NextRequest, _auth, { params }: Ctx) => {
    const { itemUuid } = await params
    await deleteImagePackItem(itemUuid)
    return new NextResponse(null, { status: 204 })
  })
)
