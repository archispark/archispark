/** Shape of apps/server/lib/plugins/registry.generated.ts, produced by
 *  scripts/generate-plugin-registry.ts from plugins/<slug>/{plugin.json,
 *  manifest.ts,icons/*.svg}. Do not hand-write a registry — regenerate it. */

export interface PluginRegistryIcon {
  slug: string
  name: string
  file: string
}

export interface PluginRegistryEntry {
  slug: string
  name: string
  version: string
  description: string | null
  type: string
  icons: PluginRegistryIcon[]
}
