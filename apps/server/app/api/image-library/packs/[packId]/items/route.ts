import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { uploadImagePackItem } from "@/lib/archimate/image-library-upload"
import { ValidationError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Ctx = { params: Promise<{ packId: string }> }

// Upload one or more images to a custom pack — multipart/form-data, field "files".
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const { packId } = await params
    const { organizationId } = await resolveActiveContext(
      auth.user,
      "write",
      auth.tokenContext
    )

    const form = await req.formData()
    const files = form.getAll("files").filter((f): f is File => f instanceof File)
    if (files.length === 0)
      throw new ValidationError(
        "Le corps de la requête doit contenir au moins un fichier ('files')."
      )

    const items = []
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      items.push(
        await uploadImagePackItem(organizationId, packId, {
          name: file.name,
          type: file.type,
          buffer,
        })
      )
    }
    return NextResponse.json(items, { status: 201 })
  })
)
