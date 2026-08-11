import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import {
  listAccessibleImagePacks,
  createCustomImagePack,
} from "@/lib/archimate/image-library-store"
import { parseBody } from "@/lib/archimate/validation"
import { ImagePackCreateSchema } from "@/lib/archimate/image-library-validation"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const { organizationId } = await resolveActiveContext(
      auth.user,
      "read",
      auth.tokenContext
    )
    return NextResponse.json(await listAccessibleImagePacks(organizationId))
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const body = parseBody(ImagePackCreateSchema, await req.json())
    const { organizationId } = await resolveActiveContext(
      auth.user,
      "write",
      auth.tokenContext
    )
    return NextResponse.json(
      await createCustomImagePack(organizationId, body),
      { status: 201 }
    )
  })
)
