/**
 * platform_admin-only route body schemas — split out from validation.ts to
 * keep that file under the size limit (see AGENTS.md). Importing `orgRole`
 * below runs validation.ts's top-level `extendZodWithOpenApi(z)` as a
 * side effect, since it's the same `z` singleton.
 */

import { z } from "zod"
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@workspace/auth"
import { orgRole } from "./validation"

export const PlatformOrganizationCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de l'organisation est requis.")
    .max(200),
  description: z.string().trim().max(2000).nullable().optional(),
})

export const PlatformOrganizationUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Le nom de l'organisation est requis.")
      .max(200)
      .optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Aucune modification fournie.",
  })

export const PlatformPluginUpdateSchema = z.object({
  enabled: z.boolean(),
})

export const PlatformOrganizationMemberAddSchema = z.object({
  user_id: z.string().min(1, "Le champ 'user_id' est requis."),
  role: orgRole,
})

export const PlatformUserUpdateSchema = z
  .object({
    role: z.enum(["user", "platform_admin"]).optional(),
    enabled: z.boolean().optional(),
    first_name: z.string().trim().max(100).nullable().optional(),
    last_name: z.string().trim().max(100).nullable().optional(),
    email: z.string().email("Adresse e-mail invalide.").optional(),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
      )
      .max(
        MAX_PASSWORD_LENGTH,
        `Le mot de passe ne peut pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`
      )
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Aucune modification fournie.",
  })

export const PlatformUserOrganizationAddSchema = z.object({
  organization_id: z.string().min(1, "Le champ 'organization_id' est requis."),
  role: orgRole,
})

export const PlatformUserCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.")
    .max(50)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Nom d'utilisateur invalide (lettres, chiffres, points, tirets, underscores)."
    ),
  email: z.string().email("Adresse e-mail invalide."),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
    )
    .max(
      MAX_PASSWORD_LENGTH,
      `Le mot de passe ne peut pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`
    ),
  first_name: z.string().trim().max(100).nullable().optional(),
  last_name: z.string().trim().max(100).nullable().optional(),
  role: z.enum(["user", "platform_admin"]).optional(),
})
