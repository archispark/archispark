import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"
import { installImagePackItems } from "@/lib/archimate/image-library-install"
import { ValidationError } from "@/lib/archimate/errors"
import { parseBody } from "@/lib/archimate/validation"
import { ImagePackManifestSchema } from "@/lib/archimate/image-library-validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Ctx = { params: Promise<{ packId: string }> }

// Bulk-installs a plugin pack into an existing custom pack — multipart/
// form-data, field "files" (*.svg) and an optional "manifest" (JSON string).
// Items are stored inline_svg, no Vercel Blob write (contrast with
// POST .../items, the single-file Blob-backed upload path).
export const POST = withErrorHandling(
  withSuperAdmin(async (req: NextRequest, _auth, { params }: Ctx) => {
    const { packId } = await params

    const form = await req.formData()
    const manifestRaw = form.get("manifest")
    const manifest = manifestRaw
      ? parseBody(ImagePackManifestSchema, JSON.parse(String(manifestRaw)))
      : undefined

    const files = form
      .getAll("files")
      .filter((f): f is File => f instanceof File)
    if (files.length === 0)
      throw new ValidationError(
        "Le corps de la requête doit contenir au moins un fichier ('files')."
      )

    const bundle = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    )
    const items = await installImagePackItems(packId, manifest, bundle)
    return NextResponse.json(items, { status: 201 })
  })
)
