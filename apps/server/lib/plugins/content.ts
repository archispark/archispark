/**
 * Reads on-disk icon SVG content for a validated (pluginSlug, iconSlug)
 * pair — the runtime counterpart to registry.ts's in-memory index. Shared
 * by the public icon route (app/api/plugins/[pluginSlug]/icons/[iconSlug]/
 * route.ts, gated on the plugin being enabled) and the platform_admin
 * preview route (app/api/platform/plugins/[slug]/icons/[iconSlug]/
 * route.ts, which previews a plugin's icons regardless of its enabled
 * state — see the "vue" of a plugin's content on /platform/plugins/[slug]).
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { lookupIcon } from "./registry"

// Unlike packages/db (an external workspace package, whose dist/ files stay
// at a stable path relative to their own import.meta.url after being copied
// as-is into node_modules by the Vercel file tracer), the routes that call
// this are first-party app code: Next's bundler relocates them into
// .next/server/**, so import.meta.url-relative resolution wouldn't reliably
// point back to the repo's plugins/ folder post-build. process.cwd() does,
// because `output: "standalone"` launches the server with its cwd at the
// app root (apps/server) — see outputFileTracingRoot in next.config.ts.
const PLUGINS_DIR = path.join(process.cwd(), "../../plugins")

/**
 * Reads an icon's SVG content, or null if the slug is unknown or doesn't
 * belong to `pluginSlug`. `iconSlug`/`pluginSlug` are only ever used as
 * *keys* into the in-memory, build-time-validated index — the actual file
 * read always uses the registry's `file` field, never a path built from the
 * caller's input, so there's no path-traversal surface here regardless of
 * what the caller passes.
 */
export function readIconSvg(
  pluginSlug: string,
  iconSlug: string
): string | null {
  const icon = lookupIcon(iconSlug)
  if (!icon || icon.pluginSlug !== pluginSlug) return null
  const filePath = path.join(PLUGINS_DIR, pluginSlug, "icons", icon.file)
  return readFileSync(filePath, "utf8")
}
