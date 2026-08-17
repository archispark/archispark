/**
 * Bulk plugin-pack install: turns a batch of SVG files (plus an optional
 * manifest) into "inline_svg" image_pack_items, in one DB transaction — no
 * Vercel Blob access, unlike image-library-upload.ts's single-file path.
 * Mirrors how packages shipped by ArchiSpark itself (ArchiMate, AWS, Azure,
 * GCP — see scripts/generate-*-icon-pack.ts) already store their icons:
 * static, versioned content belongs inline in Postgres, not in Blob.
 */

import { randomUUID } from "crypto"
import { db, imagePackItems } from "@workspace/db"
import { ValidationError } from "./errors"
import { sanitizeSvg } from "./svg-sanitize"
import {
  getManageableCustomPack,
  imagePackItemOut,
  isUniqueViolation,
  slugifyFileName,
  type ImagePackItemOut,
} from "./image-library-store"
import {
  MAX_BUNDLE_BYTES,
  MAX_ITEM_BYTES,
  MAX_PACK_ITEMS,
  type ImagePackManifest,
} from "./image-library-validation"

export interface PluginBundleFile {
  name: string
  buffer: Buffer
}

interface ResolvedEntry {
  file: string
  slug: string
  name: string
  svg: string
}

function manifestEntryFor(
  fileName: string,
  manifest: ImagePackManifest | undefined
) {
  return manifest?.items?.find((i) => i.file === fileName)
}

function resolveEntries(
  files: PluginBundleFile[],
  manifest: ImagePackManifest | undefined
): ResolvedEntry[] {
  const itemUuid = randomUUID()
  const entries = files.map((f) => {
    const declared = manifestEntryFor(f.name, manifest)
    const slug = declared?.slug ?? slugifyFileName(f.name, itemUuid)
    const name = declared?.name ?? f.name.replace(/\.svg$/i, "")
    return {
      file: f.name,
      slug,
      name,
      svg: sanitizeSvg(f.buffer.toString("utf8"), f.name),
    }
  })

  const seenSlugs = new Set<string>()
  for (const e of entries) {
    if (seenSlugs.has(e.slug))
      throw new ValidationError(
        `Le bundle contient plusieurs fichiers résolus vers le même slug '${e.slug}'.`
      )
    seenSlugs.add(e.slug)
  }
  return entries
}

function validateBundle(files: PluginBundleFile[]): void {
  if (files.length === 0)
    throw new ValidationError(
      "Le bundle doit contenir au moins un fichier '.svg'."
    )
  if (files.length > MAX_PACK_ITEMS)
    throw new ValidationError(
      `Le bundle dépasse la limite de ${MAX_PACK_ITEMS} icônes.`
    )
  let total = 0
  for (const f of files) {
    if (f.buffer.byteLength > MAX_ITEM_BYTES)
      throw new ValidationError(
        `'${f.name}' dépasse la taille maximale de ${Math.round(MAX_ITEM_BYTES / 1024)} Ko.`
      )
    total += f.buffer.byteLength
  }
  if (total > MAX_BUNDLE_BYTES)
    throw new ValidationError(
      `Le bundle dépasse la taille totale maximale de ${Math.round(MAX_BUNDLE_BYTES / (1024 * 1024))} Mo.`
    )
}

/** Bulk-installs SVG files as inline_svg items into an existing custom pack. */
export async function installImagePackItems(
  packUuid: string,
  manifest: ImagePackManifest | undefined,
  files: PluginBundleFile[]
): Promise<ImagePackItemOut[]> {
  const svgFiles = files.filter((f) => f.name.toLowerCase().endsWith(".svg"))
  validateBundle(svgFiles)
  const pack = await getManageableCustomPack(packUuid)
  const entries = resolveEntries(svgFiles, manifest)

  return db.transaction(async (tx) => {
    const rows = []
    for (const e of entries) {
      let row
      try {
        ;[row] = await tx
          .insert(imagePackItems)
          .values({
            uuid: randomUUID(),
            packId: pack.id,
            organizationId: pack.organizationId,
            slug: e.slug,
            name: e.name,
            storageKind: "inline_svg",
            svgContent: e.svg,
          })
          .onConflictDoNothing({
            target: [imagePackItems.packId, imagePackItems.slug],
          })
          .returning()
      } catch (err) {
        if (isUniqueViolation(err))
          throw new ValidationError(
            `Le slug '${e.slug}' est déjà utilisé par une autre image (le slug doit être unique parmi les packs système et, pour ce pack, parmi ceux de son organisation).`
          )
        throw err
      }
      if (row) rows.push(row)
    }
    return rows.map(imagePackItemOut)
  })
}
