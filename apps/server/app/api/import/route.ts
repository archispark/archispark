import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { getModelInfo } from "@/lib/archimate/store"
import { parseOpenExchange } from "@/lib/archimate/oxf-parser"
import { modelToDb } from "@workspace/db"
import { ValidationError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Import model from XML — accepts multipart/form-data (file field "file") or raw XML body
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const contentType = req.headers.get("content-type") ?? ""
    let xml: string
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof Blob))
        throw new ValidationError(
          "Le corps de la requête doit être un XML valide."
        )
      xml = await file.text()
    } else {
      xml = await req.text()
    }
    if (!xml)
      throw new ValidationError(
        "Le corps de la requête doit être un XML valide."
      )

    let newModel: ReturnType<typeof parseOpenExchange>
    try {
      newModel = parseOpenExchange(xml)
    } catch (err) {
      throw new ValidationError(
        `Erreur de parsing XML : ${(err as Error).message}`
      )
    }

    const wsId = await activeWorkspaceId(auth, "write")
    await modelToDb(wsId, newModel)
    return NextResponse.json(await getModelInfo(wsId))
  })
)
