import { z } from "zod"
import { PROPERTY_DEFINITION_TYPES, VIEWPOINTS } from "@/lib/archimate/schemas"

export const PROPERTY_DEFINITION_TYPES_STR = [...PROPERTY_DEFINITION_TYPES]
  .sort((a, b) => a.localeCompare(b))
  .join(", ")
export const VIEWPOINTS_STR = [...VIEWPOINTS]
  .sort((a, b) => a.localeCompare(b))
  .join(", ")
export const EDGE_SIDES_STR = "top, right, bottom, left"

export function toContent(data: unknown): {
  content: [{ type: "text"; text: string }]
} {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] }
}

export const propertyItemSchema = z.object({
  property_definition_ref: z
    .string()
    .describe("Référence à la définition de propriété"),
  value: z.string().describe("Valeur de la propriété"),
})
