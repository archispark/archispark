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
