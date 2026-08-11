import { eq } from "drizzle-orm"
import { db } from "./connection.js"
import { imagePackItems, imagePacks, workspaces } from "./schema.js"

export const IMAGE_REF_PREFIX = "img-"

/** `img-<uuid>` — a reference to an `image_pack_items` row. */
export function isImageReference(value: string): boolean {
  return /^img-[0-9a-f-]{36}$/i.test(value)
}

/**
 * Pre-image-library format: an http(s) URL or a relative path. Kept as a
 * legacy passthrough so elements that already stored a raw URL in
 * `archispark_image` keep working — new values should be `img-<uuid>`
 * references instead.
 */
export function isLegacyImageUrl(value: string): boolean {
  if (!value || /\s/.test(value)) return false
  if (value.startsWith("/")) return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Resolves an `archispark_image` value to a displayable URL, scoped to the
 * caller's workspace: an `img-<uuid>` reference only resolves if it points
 * to the system pack or to a pack owned by the workspace's organization.
 * A legacy URL/path resolves to itself. Returns null if unresolved.
 */
export async function resolveImageReference(
  value: string,
  wsId: number,
  dbClient: typeof db = db
): Promise<string | null> {
  if (!isImageReference(value)) {
    return isLegacyImageUrl(value) ? value : null
  }

  const uuid = value.slice(IMAGE_REF_PREFIX.length)
  const [row] = await dbClient
    .select({
      packOrganizationId: imagePacks.organizationId,
      storageKind: imagePackItems.storageKind,
      blobUrl: imagePackItems.blobUrl,
    })
    .from(imagePackItems)
    .innerJoin(imagePacks, eq(imagePackItems.packId, imagePacks.id))
    .where(eq(imagePackItems.uuid, uuid))
  if (!row) return null

  if (row.packOrganizationId !== null) {
    const [ws] = await dbClient
      .select({ organizationId: workspaces.organizationId })
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
    if (!ws || ws.organizationId !== row.packOrganizationId) return null
  }

  return row.storageKind === "blob"
    ? (row.blobUrl ?? null)
    : `/api/image-library/items/${uuid}/svg`
}

/** Throws if `value` isn't a resolvable image reference nor a legacy URL. */
export async function assertImageReferenceValid(
  value: string,
  wsId: number,
  dbClient: typeof db = db
): Promise<void> {
  const resolved = await resolveImageReference(value, wsId, dbClient)
  if (resolved === null) {
    throw new Error(
      "La propriété « archispark_image » doit référencer une image de la bibliothèque ou être une URL HTTP(S) valide."
    )
  }
}
