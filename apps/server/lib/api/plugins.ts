import { get, put } from "./client"

/** Mirrors @workspace/db's ARCHISPARK_IMAGE_PROPERTY_ID — duplicated here so
 *  client components can identify the property without importing
 *  @workspace/db (which pulls in the Postgres driver). */
export const ARCHISPARK_IMAGE_PROPERTY_ID = "archispark-image"

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

export interface PlatformPluginOut {
  slug: string
  name: string
  version: string
  description: string | null
  type: string
  icon_count: number
  enabled: boolean
}

export interface PlatformPluginDetailOut extends PlatformPluginOut {
  icons: PluginIconOut[]
}

export interface PlatformPluginUpdateIn {
  enabled: boolean
}

/** Public — every authenticated user, for the icon picker. Enabled plugins
 *  only. */
export const fetchPlugins = () => get<PluginOut[]>("/plugins")

/** platform_admin — every discovered plugin, enabled or not. */
export const fetchPlatformPlugins = () =>
  get<PlatformPluginOut[]>("/platform/plugins")

/** platform_admin — one plugin's content (dispatch on `type`), with
 *  admin-preview icon urls readable regardless of enabled state. */
export const fetchPlatformPlugin = (slug: string) =>
  get<PlatformPluginDetailOut>(`/platform/plugins/${encodeURIComponent(slug)}`)

export const updatePlatformPluginApi = (
  slug: string,
  body: PlatformPluginUpdateIn
) =>
  put<PlatformPluginOut>(`/platform/plugins/${encodeURIComponent(slug)}`, body)

export const setPlatformPluginEnabled = (slug: string, enabled: boolean) =>
  updatePlatformPluginApi(slug, { enabled })
