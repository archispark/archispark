/**
 * Resolution of `Archispark Plugin IconPack` values. Replaces
 * packages/db's former image-library.ts: packages/db must not know about
 * plugins/ (a filesystem concept owned by apps/server), so this logic lives
 * here instead and is injected into packages/db via system-properties.ts's
 * ImageReferenceValidator parameter (see model-io.ts).
 */

import { lookupIcon } from "./registry"
import { getEnabledPluginSlugs } from "./service"

/** A slug referencing a plugin icon (e.g. "aws-lambda"). */
export function isImageSlugReference(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
}

/**
 * Pre-plugin-system format: an http(s) URL or a relative path. Kept as a
 * legacy passthrough so elements that already stored a raw URL in
 * `Archispark Plugin IconPack` keep working — new values should be icon
 * slugs instead.
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

/** Sync, no DB — does this slug exist in *some* plugin's icon set, enabled
 *  or not? Used for write-time validation: disabling a plugin later doesn't
 *  retroactively invalidate values already stored, it only stops them from
 *  resolving to a URL at render time (see resolveImageReference below). */
export function isKnownIconSlug(value: string): boolean {
  return lookupIcon(value) !== undefined
}

export function isResolvableImageReference(value: string): boolean {
  return isImageSlugReference(value)
    ? isKnownIconSlug(value)
    : isLegacyImageUrl(value)
}

function iconUrl(pluginSlug: string, iconSlug: string): string {
  return `/api/plugins/${pluginSlug}/icons/${iconSlug}`
}

/** Resolves a single `Archispark Plugin IconPack` value to a displayable
 *  URL, or null if unresolved (unknown slug, or its plugin is disabled). */
export async function resolveImageReference(
  value: string
): Promise<string | null> {
  if (!isImageSlugReference(value))
    return isLegacyImageUrl(value) ? value : null
  const icon = lookupIcon(value)
  if (!icon) return null
  const enabled = await getEnabledPluginSlugs()
  if (!enabled.has(icon.pluginSlug)) return null
  return iconUrl(icon.pluginSlug, value)
}

/** Batch resolution — one DB query for the whole set of values, not one per
 *  value (fixes the N+1 of the old per-element resolveImageReference calls
 *  in image-library-resolve.ts). Returns a Map keyed by the input value. */
export async function resolveImageReferences(
  values: string[]
): Promise<Map<string, string>> {
  const enabled = await getEnabledPluginSlugs()
  const result = new Map<string, string>()
  for (const value of values) {
    if (result.has(value)) continue
    if (!isImageSlugReference(value)) {
      if (isLegacyImageUrl(value)) result.set(value, value)
      continue
    }
    const icon = lookupIcon(value)
    if (icon && enabled.has(icon.pluginSlug))
      result.set(value, iconUrl(icon.pluginSlug, value))
  }
  return result
}
