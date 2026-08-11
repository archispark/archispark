/**
 * Batch resolution of `archispark_image` values for a whole model — used by
 * the SVG renderer (server-side export) and by DTO serializers (a single
 * lookup per element, see store.ts's `resolved_image_url`).
 */

import {
  ARCHISPARK_IMAGE_PROPERTY_ID,
  resolveImageReference,
  type ArchiModel,
} from "@workspace/db"
import type { ElementOut } from "./schemas"

export { resolveImageReference } from "@workspace/db"

/** Attaches `resolved_image_url` to an ElementOut DTO, when it has an
 *  `archispark_image` value (used by store.ts's element read/write paths). */
export async function attachResolvedElementImage(
  element: ElementOut,
  wsId: number
): Promise<ElementOut> {
  const prop = element.properties.find(
    (p) => p.property_definition_ref === ARCHISPARK_IMAGE_PROPERTY_ID
  )
  if (!prop) return element
  const resolved_image_url = await resolveImageReference(prop.value, wsId)
  return { ...element, resolved_image_url }
}

export async function attachResolvedElementImages(
  elements: ElementOut[],
  wsId: number
): Promise<ElementOut[]> {
  return Promise.all(elements.map((e) => attachResolvedElementImage(e, wsId)))
}

/** uuid (element or relationship) -> resolved image URL, for every entity
 *  that has a resolvable `archispark_image` value. */
export async function resolveElementImages(
  model: ArchiModel,
  wsId: number
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  async function resolveInto(uuid: string, props: Record<string, string>) {
    const value = props[ARCHISPARK_IMAGE_PROPERTY_ID]
    if (value === undefined) return
    const resolved = await resolveImageReference(value, wsId)
    if (resolved !== null) result.set(uuid, resolved)
  }

  for (const e of model.elements) await resolveInto(e.uuid, e.props)
  for (const r of model.relationships) await resolveInto(r.uuid, r.props)

  return result
}
