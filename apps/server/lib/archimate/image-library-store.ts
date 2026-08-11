/**
 * Image library — DB-only CRUD for image packs and their items (no Vercel
 * Blob access; see image-library-upload.ts for the blob-backed parts of
 * custom packs: uploading an item and deleting a pack/item, which both need
 * to clean up blob objects alongside their DB rows).
 */

import { randomUUID } from "crypto"
import { eq, inArray, isNull, or } from "drizzle-orm"
import { db, imagePacks, imagePackItems } from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors"

const UNIQUE_VIOLATION = "23505"

// Drizzle wraps the raw pg error in a DrizzleQueryError, with the pg error
// (and its `.code`) as `.cause` — check both shapes.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION
}

export interface ImagePackItemOut {
  identifier: string
  slug: string
  name: string
  archimate_type: string | null
  resolved_url: string
}

export interface ImagePackOut {
  identifier: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  items: ImagePackItemOut[]
}

export function imagePackItemOut(
  row: typeof imagePackItems.$inferSelect
): ImagePackItemOut {
  return {
    identifier: row.uuid,
    slug: row.slug,
    name: row.name,
    archimate_type: row.archimateType,
    resolved_url:
      row.storageKind === "blob"
        ? (row.blobUrl ?? "")
        : `/api/image-library/items/${row.uuid}/svg`,
  }
}

function imagePackOut(
  row: typeof imagePacks.$inferSelect,
  items: (typeof imagePackItems.$inferSelect)[]
): ImagePackOut {
  return {
    identifier: row.uuid,
    slug: row.slug,
    name: row.name,
    description: row.description,
    is_system: row.isSystem,
    items: items.map(imagePackItemOut),
  }
}

/** System pack first, then this organization's custom packs — each with its items. */
export async function listAccessibleImagePacks(
  organizationId: number
): Promise<ImagePackOut[]> {
  const packs = await db
    .select()
    .from(imagePacks)
    .where(
      or(
        isNull(imagePacks.organizationId),
        eq(imagePacks.organizationId, organizationId)
      )
    )
  if (packs.length === 0) return []

  const items = await db
    .select()
    .from(imagePackItems)
    .where(
      inArray(
        imagePackItems.packId,
        packs.map((p) => p.id)
      )
    )
  const itemsByPack = new Map<number, (typeof imagePackItems.$inferSelect)[]>()
  for (const item of items) {
    const list = itemsByPack.get(item.packId) ?? []
    list.push(item)
    itemsByPack.set(item.packId, list)
  }

  return packs
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem))
    .map((pack) => imagePackOut(pack, itemsByPack.get(pack.id) ?? []))
}

export async function createCustomImagePack(
  organizationId: number,
  input: { name: string; slug: string }
): Promise<ImagePackOut> {
  try {
    const [row] = await db
      .insert(imagePacks)
      .values({
        uuid: randomUUID(),
        organizationId,
        isSystem: false,
        slug: input.slug,
        name: input.name,
      })
      .returning()
    if (!row) throw new Error("Failed to create image pack")
    return imagePackOut(row, [])
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ValidationError(
        `Un pack d'images avec le slug '${input.slug}' existe déjà pour cette organisation.`
      )
    }
    throw err
  }
}

/** Verifies `packUuid` is a custom pack owned by `organizationId`. */
export async function getOwnedCustomPack(
  organizationId: number,
  packUuid: string
): Promise<typeof imagePacks.$inferSelect> {
  const [pack] = await db
    .select()
    .from(imagePacks)
    .where(eq(imagePacks.uuid, packUuid))
  if (!pack || pack.organizationId !== organizationId)
    throw new NotFoundError(`Pack d'images '${packUuid}' introuvable.`)
  return pack
}

/** Public — serves the inline SVG of a system-pack item only (no auth, no
 *  org scoping: custom-pack items are always storageKind "blob" and use
 *  their own public Blob URL instead). */
export async function getSystemInlineSvgItem(
  itemUuid: string
): Promise<string | null> {
  const [row] = await db
    .select({
      storageKind: imagePackItems.storageKind,
      svgContent: imagePackItems.svgContent,
      packOrganizationId: imagePacks.organizationId,
    })
    .from(imagePackItems)
    .innerJoin(imagePacks, eq(imagePackItems.packId, imagePacks.id))
    .where(eq(imagePackItems.uuid, itemUuid))
  if (!row || row.storageKind !== "inline_svg" || !row.svgContent) return null
  if (row.packOrganizationId !== null) return null
  return row.svgContent
}
