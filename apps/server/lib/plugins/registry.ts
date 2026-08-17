/**
 * In-memory icon index built once from the generated registry — the
 * discovery half of the plugins/ system (see PLAN: discovery is build-time,
 * activation is runtime via the `plugins` DB table, see service.ts).
 */

import { PLUGIN_REGISTRY } from "./registry.generated"
import type { PluginRegistryEntry } from "./types"

export interface IconLookup {
  pluginSlug: string
  file: string
  name: string
}

const ICON_INDEX = new Map<string, IconLookup>()
for (const plugin of Object.values(PLUGIN_REGISTRY)) {
  for (const icon of plugin.icons) {
    ICON_INDEX.set(icon.slug, {
      pluginSlug: plugin.slug,
      file: icon.file,
      name: icon.name,
    })
  }
}

/** Looks up an icon slug across every plugin (enabled or not — activation is
 *  checked separately, see resolve.ts). */
export function lookupIcon(iconSlug: string): IconLookup | undefined {
  return ICON_INDEX.get(iconSlug)
}

export function listRegistryPlugins(): PluginRegistryEntry[] {
  return Object.values(PLUGIN_REGISTRY)
}

export function getRegistryPlugin(
  slug: string
): PluginRegistryEntry | undefined {
  return PLUGIN_REGISTRY[slug]
}
