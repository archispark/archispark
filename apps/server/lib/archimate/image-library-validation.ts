import { z } from "zod"

export const ImagePackCreateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
  slug: z
    .string()
    .min(1, "Le champ 'slug' est requis.")
    .regex(
      /^[a-z0-9-]+$/,
      "Le champ 'slug' ne peut contenir que des lettres minuscules, chiffres et tirets."
    ),
})

// Bornes du flux d'installation bulk (POST .../packs/:packId/install) — un
// SVG seul n'a pas besoin des 2 Mo tolérés pour un PNG/JPEG uploadé un par
// un (voir MAX_FILE_BYTES dans image-library-upload.ts), et Azure (638
// items déjà en base) fixe l'ordre de grandeur raisonnable pour un pack.
export const MAX_PACK_ITEMS = 1000
export const MAX_ITEM_BYTES = 512 * 1024
export const MAX_BUNDLE_BYTES = 25 * 1024 * 1024

const SlugSchema = z
  .string()
  .regex(
    /^[a-z0-9-]+$/,
    "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets."
  )

export const ImagePackManifestItemSchema = z.object({
  file: z.string().min(1),
  slug: SlugSchema.optional(),
  name: z.string().min(1).optional(),
})

export const ImagePackManifestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  items: z.array(ImagePackManifestItemSchema).max(MAX_PACK_ITEMS).optional(),
})

export type ImagePackManifest = z.infer<typeof ImagePackManifestSchema>
