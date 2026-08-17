import { db } from "./connection.js"
import { assertImageReferenceValid } from "./image-library.js"

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

/**
 * Validates system property values, scoped to `wsId` — `archispark_image`
 * must be a resolvable image-library reference (a pack item slug) or a
 * legacy URL/path (see image-library.ts). An empty value means "no image
 * set" and skips validation, same as the property being absent.
 */
export async function assertSystemPropertyValues(
  properties: Record<string, string>,
  wsId: number,
  dbClient: typeof db = db
): Promise<void> {
  const image = properties[ARCHISPARK_IMAGE_PROPERTY_ID]
  if (!image) return
  await assertImageReferenceValid(image, wsId, dbClient)
}
