/**
 * Zod mirrors of plugins/<slug>/plugin.json and manifest.ts's default
 * export, enforced by scripts/generate-plugin-registry.ts. The TS types in
 * types.ts / @workspace/types are edit-time hints only — this is the real
 * guard-rail, since manifest.ts's `IconPluginManifest` import is type-only
 * and erased before the script ever runs.
 */

import { z } from "zod"

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const PluginJsonSchema = z.object({
  id: z.string().regex(slugPattern, "id must be kebab-case"),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1).optional(),
  type: z.literal("icon-pack"),
})

export type PluginJson = z.infer<typeof PluginJsonSchema>

const IconPluginManifestIconSchema = z.object({
  slug: z.string().regex(slugPattern, "icon slug must be kebab-case"),
  name: z.string().min(1),
  file: z
    .string()
    .regex(/^[^/\\]+\.svg$/, "file must be a bare *.svg filename"),
})

export const IconPluginManifestSchema = z.object({
  icons: z.array(IconPluginManifestIconSchema),
})

export type IconPluginManifestParsed = z.infer<typeof IconPluginManifestSchema>
