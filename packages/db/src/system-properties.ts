export const ARCHISPARK_IMAGE_PROPERTY_ID = "archispark-image"

export const SYSTEM_PROPERTY_DEFINITIONS = [
  {
    uuid: ARCHISPARK_IMAGE_PROPERTY_ID,
    name: "archispark_image",
    type: "string",
  },
] as const

export function isSystemPropertyDefinition(id: string): boolean {
  return SYSTEM_PROPERTY_DEFINITIONS.some(
    (definition) => definition.uuid === id
  )
}

export function assertSystemPropertyValues(
  properties: Record<string, string>
): void {
  const image = properties[ARCHISPARK_IMAGE_PROPERTY_ID]
  if (image !== undefined && !isImageUrl(image)) {
    throw new Error(
      "La propriété « archispark_image » doit être une URL HTTP(S) ou un chemin relatif valide."
    )
  }
}

function isImageUrl(value: string): boolean {
  if (!value || /\s/.test(value)) return false
  if (value.startsWith("/")) return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
