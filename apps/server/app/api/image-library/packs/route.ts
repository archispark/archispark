import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth, withSuperAdmin } from "@/lib/http/with-auth"
import {
  listAllImagePacks,
  createCustomImagePack,
} from "@/lib/archimate/image-library-store"
import { parseBody } from "@/lib/archimate/validation"
import { ImagePackCreateSchema } from "@/lib/archimate/image-library-validation"

export const dynamic = "force-dynamic"

// Instance-wide, same list for every organization — any authenticated user
// can browse it (picking an image for an element), only platform_admin can
// manage it (POST below), from /platform/plugins.
export const GET = withErrorHandling(
  withAuth(async () => {
    return NextResponse.json(await listAllImagePacks())
  })
)

export const POST = withErrorHandling(
  withSuperAdmin(async (req: NextRequest) => {
    const body = parseBody(ImagePackCreateSchema, await req.json())
    return NextResponse.json(await createCustomImagePack(body), {
      status: 201,
    })
  })
)
