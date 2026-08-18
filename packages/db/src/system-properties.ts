export const ARCHISPARK_IMAGE_PROPERTY_ID = "archispark-plugin-iconpack"

export const SYSTEM_PROPERTY_DEFINITIONS = [
  {
    uuid: ARCHISPARK_IMAGE_PROPERTY_ID,
    name: "Archispark Plugin IconPack",
    type: "string",
  },
] as const

export function isSystemPropertyDefinition(id: string): boolean {
  return SYSTEM_PROPERTY_DEFINITIONS.some(
    (definition) => definition.uuid === id
  )
}

/** Checks whether an `Archispark Plugin IconPack` value is resolvable — a
 *  known plugin icon slug or a legacy URL/path. packages/db doesn't know
 *  about plugins/ (a filesystem concept owned by apps/server), so the actual
 *  check is injected by the caller (see apps/server/lib/plugins/resolve.ts's
 *  isResolvableImageReference). */
export type ImageReferenceValidator = (value: string) => boolean

/**
 * Validates system property values — `Archispark Plugin IconPack` must
 * satisfy `isValidImageReference`. An empty value means "no image set" and
 * skips validation, same as the property being absent.
 */
export function assertSystemPropertyValues(
  properties: Record<string, string>,
  isValidImageReference: ImageReferenceValidator
): void {
  const image = properties[ARCHISPARK_IMAGE_PROPERTY_ID]
  if (!image) return
  if (!isValidImageReference(image))
    throw new Error(
      "La propriété « Archispark Plugin IconPack » doit référencer une icône de plugin connue ou être une URL HTTP(S) valide."
    )
}
