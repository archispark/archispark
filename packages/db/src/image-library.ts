import { and, eq, isNull } from "drizzle-orm"
import { db } from "./connection.js"
import { imagePackItems, workspaces } from "./schema.js"

/** A slug referencing an `image_pack_items` row (e.g. "aws-lambda"). */
export function isImageSlugReference(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
}

/**
 * Pre-image-library format: an http(s) URL or a relative path. Kept as a
 * legacy passthrough so elements that already stored a raw URL in
 * `archispark_image` keep working — new values should be slug references
 * instead.
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

function toUrl(row: {
  uuid: string
  storageKind: string
  blobUrl: string | null
}): string | null {
  return row.storageKind === "blob"
    ? (row.blobUrl ?? null)
    : `/api/image-library/items/${row.uuid}/svg`
}

/**
 * Resolves an `archispark_image` value to a displayable URL, scoped to the
 * caller's workspace: a slug reference resolves against the workspace's
 * organization's own packs first (so a custom pack can override a vendor
 * icon by reusing its slug), then against the system packs shared by every
 * organization. A legacy URL/path resolves to itself. Returns null if
 * unresolved.
 */
export async function resolveImageReference(
  value: string,
  wsId: number,
  dbClient: typeof db = db
): Promise<string | null> {
  if (!isImageSlugReference(value)) {
    return isLegacyImageUrl(value) ? value : null
  }

  const [ws] = await dbClient
    .select({ organizationId: workspaces.organizationId })
    .from(workspaces)
    .where(eq(workspaces.id, wsId))
  if (!ws) return null

  const itemColumns = {
    uuid: imagePackItems.uuid,
    storageKind: imagePackItems.storageKind,
    blobUrl: imagePackItems.blobUrl,
  }

  if (ws.organizationId !== null) {
    const [orgRow] = await dbClient
      .select(itemColumns)
      .from(imagePackItems)
      .where(
        and(
          eq(imagePackItems.organizationId, ws.organizationId),
          eq(imagePackItems.slug, value)
        )
      )
    if (orgRow) return toUrl(orgRow)
  }

  const [systemRow] = await dbClient
    .select(itemColumns)
    .from(imagePackItems)
    .where(
      and(isNull(imagePackItems.organizationId), eq(imagePackItems.slug, value))
    )
  return systemRow ? toUrl(systemRow) : null
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
