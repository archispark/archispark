/**
 * Attaches/collects `resolved_image_url` for `Archispark Plugin IconPack`
 * values — used by store.ts's DTO serializers (single/batch) and by the SVG
 * renderer's whole-model batch resolution (export/MCP consumers). Replaces
 * the old image-library-resolve.ts; no longer workspace-scoped (plugins are
 * instance-wide, not per-organization).
 */

import { ARCHISPARK_IMAGE_PROPERTY_ID, type ArchiModel } from "@workspace/db"
import type { ElementOut } from "../archimate/schemas"
import { resolveImageReference, resolveImageReferences } from "./resolve"

export { resolveImageReference } from "./resolve"

function imageValue(element: ElementOut): string | undefined {
  return element.properties.find(
    (p) => p.property_definition_ref === ARCHISPARK_IMAGE_PROPERTY_ID
  )?.value
}

/** Attaches `resolved_image_url` to an ElementOut DTO, when it has an
 *  `Archispark Plugin IconPack` value. */
export async function attachResolvedElementImage(
  element: ElementOut
): Promise<ElementOut> {
  const value = imageValue(element)
  if (value === undefined) return element
  const resolved_image_url = await resolveImageReference(value)
  return { ...element, resolved_image_url }
}

/** Batch variant — one DB query for the whole list, not one per element. */
export async function attachResolvedElementImages(
  elements: ElementOut[]
): Promise<ElementOut[]> {
  const values = elements
    .map(imageValue)
    .filter((v): v is string => v !== undefined)
  const resolved = await resolveImageReferences(values)
  return elements.map((e) => {
    const value = imageValue(e)
    if (value === undefined) return e
    return { ...e, resolved_image_url: resolved.get(value) ?? null }
  })
}

/** uuid (element or relationship) -> resolved image URL, for every entity
 *  that has a resolvable `Archispark Plugin IconPack` value. Used by the
 *  SVG renderer and export/MCP consumers, which need the whole model at
 *  once. */
export async function resolveElementImages(
  model: ArchiModel
): Promise<Map<string, string>> {
  const entries: Array<{ uuid: string; value: string }> = []
  for (const e of model.elements) {
    const value = e.props[ARCHISPARK_IMAGE_PROPERTY_ID]
    if (value !== undefined) entries.push({ uuid: e.uuid, value })
  }
  for (const r of model.relationships) {
    const value = r.props[ARCHISPARK_IMAGE_PROPERTY_ID]
    if (value !== undefined) entries.push({ uuid: r.uuid, value })
  }

  const resolved = await resolveImageReferences(entries.map((e) => e.value))
  const result = new Map<string, string>()
  for (const { uuid, value } of entries) {
    const url = resolved.get(value)
    if (url !== undefined) result.set(uuid, url)
  }
  return result
}
