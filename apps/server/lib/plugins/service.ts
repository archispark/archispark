/**
 * platform_admin-facing plugin administration — joins the build-time
 * registry (identity, version, icon list) with the runtime `enabled` flag
 * stored in the `plugins` DB table (see registry.ts for the discovery half).
 * A plugin present in the registry but absent from the table is treated as
 * disabled by default; the first PUT {enabled} upserts its row.
 */

import { eq } from "drizzle-orm"
import { db, plugins } from "@workspace/db"
import { NotFoundError } from "../archimate/errors"
import { listRegistryPlugins, getRegistryPlugin } from "./registry"

export interface PlatformPluginOut {
  slug: string
  name: string
  version: string
  description: string | null
  type: string
  icon_count: number
  enabled: boolean
}

export interface PlatformPluginIconOut {
  slug: string
  name: string
  url: string
}

export interface PlatformPluginDetailOut extends PlatformPluginOut {
  icons: PlatformPluginIconOut[]
}

/** platform_admin — every discovered plugin, enabled or not. */
export async function listPlatformPlugins(): Promise<PlatformPluginOut[]> {
  const rows = await db.select().from(plugins)
  const enabledBySlug = new Map(rows.map((r) => [r.slug, r.enabled]))
  return listRegistryPlugins().map((entry) => ({
    slug: entry.slug,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    type: entry.type,
    icon_count: entry.icons.length,
    enabled: enabledBySlug.get(entry.slug) ?? false,
  }))
}

/** platform_admin — one plugin's content, for the /platform/plugins/[slug]
 *  detail view: what it is (dispatch on `type`) and, for an icon-pack, its
 *  full icon list with admin-preview URLs (readable regardless of enabled
 *  state, see app/api/platform/plugins/[slug]/icons/[iconSlug]/route.ts). */
export async function getPlatformPlugin(
  slug: string
): Promise<PlatformPluginDetailOut> {
  const entry = getRegistryPlugin(slug)
  if (!entry) throw new NotFoundError(`Plugin '${slug}' introuvable.`)

  const [row] = await db
    .select({ enabled: plugins.enabled })
    .from(plugins)
    .where(eq(plugins.slug, slug))

  return {
    slug: entry.slug,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    type: entry.type,
    icon_count: entry.icons.length,
    enabled: row?.enabled ?? false,
    icons: entry.icons.map((icon) => ({
      slug: icon.slug,
      name: icon.name,
      url: `/api/platform/plugins/${entry.slug}/icons/${icon.slug}`,
    })),
  }
}

export async function setPluginEnabled(
  slug: string,
  enabled: boolean
): Promise<PlatformPluginOut> {
  if (!getRegistryPlugin(slug))
    throw new NotFoundError(`Plugin '${slug}' introuvable.`)

  const now = Math.floor(Date.now() / 1000)
  await db
    .insert(plugins)
    .values({ slug, enabled, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: plugins.slug,
      set: { enabled, updatedAt: now },
    })

  const all = await listPlatformPlugins()
  const updated = all.find((p) => p.slug === slug)
  // v8 ignore next — unreachable: the row was just written above
  if (!updated) throw new NotFoundError(`Plugin '${slug}' introuvable.`)
  return updated
}

/** The set of currently-enabled plugin slugs — one query, consulted by the
 *  batch icon resolver (resolve.ts) instead of a per-icon lookup. */
export async function getEnabledPluginSlugs(): Promise<Set<string>> {
  const rows = await db
    .select({ slug: plugins.slug })
    .from(plugins)
    .where(eq(plugins.enabled, true))
  return new Set(rows.map((r) => r.slug))
}

export interface PluginIconOut {
  slug: string
  name: string
  url: string
}

export interface PluginOut {
  slug: string
  name: string
  description: string | null
  icons: PluginIconOut[]
}

/** Public — enabled plugins with their icons, for the icon picker. */
export async function listEnabledPluginsWithIcons(): Promise<PluginOut[]> {
  const enabled = await getEnabledPluginSlugs()
  return listRegistryPlugins()
    .filter((entry) => enabled.has(entry.slug))
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      icons: entry.icons.map((icon) => ({
        slug: icon.slug,
        name: icon.name,
        url: `/api/plugins/${entry.slug}/icons/${icon.slug}`,
      })),
    }))
}
