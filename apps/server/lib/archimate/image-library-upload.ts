/**
 * Vercel Blob-backed parts of the image library: uploading an item to a
 * custom pack, and deleting an item/pack (which must also delete the
 * underlying blob object — Postgres cascade only removes the DB row).
 */

import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { put, del } from "@vercel/blob"
import { db, imagePackItems, imagePacks } from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors"
import { sanitizeSvg } from "./svg-sanitize"
import {
  getManageableCustomPack,
  imagePackItemOut,
  isUniqueViolation,
  slugifyFileName,
  type ImagePackItemOut,
} from "./image-library-store"

const ALLOWED_MIME_TYPES = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
])
const MAX_FILE_BYTES = 2 * 1024 * 1024

function blobToken(): string {
  const token = process.env["BLOB_READ_WRITE_TOKEN"]
  if (!token)
    throw new ValidationError(
      "Le stockage d'images (Vercel Blob) n'est pas configuré : BLOB_READ_WRITE_TOKEN est manquant."
    )
  return token
}

export async function uploadImagePackItem(
  packUuid: string,
  file: { name: string; type: string; buffer: Buffer }
): Promise<ImagePackItemOut> {
  const token = blobToken()
  if (!ALLOWED_MIME_TYPES.has(file.type))
    throw new ValidationError(
      `Type de fichier non supporté : '${file.type}'. Formats acceptés : SVG, PNG, JPEG, WebP.`
    )
  if (file.buffer.byteLength > MAX_FILE_BYTES)
    throw new ValidationError("Le fichier dépasse la taille maximale de 2 Mo.")

  // Only SVG can carry executable markup (script, event handler attributes,
  // external references) — PNG/JPEG/WebP are opaque raster data.
  const buffer =
    file.type === "image/svg+xml"
      ? Buffer.from(sanitizeSvg(file.buffer.toString("utf8"), file.name))
      : file.buffer

  const pack = await getManageableCustomPack(packUuid)
  const itemUuid = randomUUID()
  const slug = slugifyFileName(file.name, itemUuid)
  const blob = await put(`image-library/${packUuid}/${slug}`, buffer, {
    access: "public",
    contentType: file.type,
    token,
  })

  let row
  try {
    ;[row] = await db
      .insert(imagePackItems)
      .values({
        uuid: itemUuid,
        packId: pack.id,
        organizationId: pack.organizationId,
        slug,
        name: file.name,
        storageKind: "blob",
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        mimeType: file.type,
      })
      .returning()
  } catch (err) {
    if (isUniqueViolation(err))
      throw new ValidationError(
        `Le slug '${slug}' est déjà utilisé par une autre image (le slug doit être unique parmi les packs système et, pour ce pack, parmi ceux de son organisation).`
      )
    throw err
  }
  if (!row) throw new Error("Failed to create image pack item")
  return imagePackItemOut(row)
}

export async function deleteImagePackItem(itemUuid: string): Promise<void> {
  const [row] = await db
    .select({
      id: imagePackItems.id,
      blobPathname: imagePackItems.blobPathname,
      packIsSystem: imagePacks.isSystem,
    })
    .from(imagePackItems)
    .innerJoin(imagePacks, eq(imagePackItems.packId, imagePacks.id))
    .where(eq(imagePackItems.uuid, itemUuid))
  if (!row || row.packIsSystem)
    throw new NotFoundError(`Image '${itemUuid}' introuvable.`)

  if (row.blobPathname) await del(row.blobPathname, { token: blobToken() })
  await db.delete(imagePackItems).where(eq(imagePackItems.id, row.id))
}

export async function deleteCustomImagePack(packUuid: string): Promise<void> {
  const pack = await getManageableCustomPack(packUuid)
  const items = await db
    .select({ blobPathname: imagePackItems.blobPathname })
    .from(imagePackItems)
    .where(eq(imagePackItems.packId, pack.id))
  const pathnames = items
    .map((i) => i.blobPathname)
    .filter((p): p is string => Boolean(p))
  if (pathnames.length > 0) {
    const token = blobToken()
    await del(pathnames, { token })
  }
  await db.delete(imagePacks).where(eq(imagePacks.id, pack.id)) // cascades items
}
