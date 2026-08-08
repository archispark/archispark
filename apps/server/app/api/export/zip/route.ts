import { NextResponse, type NextRequest } from "next/server"
import { Readable } from "node:stream"
// archiver@8 is a pure-ESM package whose runtime exports a named `ZipArchive`
// class. A static namespace import is statically analyzable, so the bundler
// (Vercel) includes archiver in the function — unlike the old createRequire()
// form which crashed at load with "Cannot find module 'archiver'". The cast
// bridges the @types/archiver typings (which still describe the old CJS API
// and don't declare ZipArchive).
import type { Archiver, ZipOptions } from "archiver"
import * as archiverNs from "archiver"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { activeWorkspaceId } from "@/lib/archimate/access"
import { loadModel } from "@/lib/archimate/store"
import { serializeToOpenExchange } from "@/lib/archimate/oxf-serializer"
import { renderViewToSvg } from "@/lib/archimate/renderer"

const ZipArchive = (
  archiverNs as unknown as { ZipArchive: new (opts?: ZipOptions) => Archiver }
).ZipArchive

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Export model + all view SVGs as a ZIP archive
export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const model = await loadModel(await activeWorkspaceId(auth, "read"))
    const modelName = model.name || "model"

    const archive = new ZipArchive({ zlib: { level: 9 } })
    // The stream is already handed off to NextResponse by the time archiving
    // fails, so headers can't change — just keep the process alive.
    archive.on("error", (err) => {
      console.error("Erreur lors de la génération du ZIP :", err)
    })
    archive.append(serializeToOpenExchange(model), {
      name: `${modelName}.xml`,
    })
    for (const view of model.views) {
      const svg = renderViewToSvg(view, model)
      const safeName = view.name.replace(/[^a-zA-Z0-9_-]/g, "_")
      archive.append(svg, { name: `views/${safeName}.svg` })
    }
    void archive.finalize()

    return new NextResponse(Readable.toWeb(archive) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${modelName}.zip"`,
      },
    })
  })
)
