/**
 * Rejects SVG markup that could execute code in the viewer's browser once
 * served back verbatim (no auth) by GET /api/image-library/items/:uuid/svg.
 * Used for every SVG that ends up as an inline_svg image_pack_items row,
 * whether uploaded one at a time (image-library-upload.ts) or in bulk
 * (image-library-install.ts) — both come from an untrusted file, unlike the
 * SVGs shipped in packages/image-library/assets/**, which are reviewed in PR.
 *
 * Rejects outright rather than stripping silently, so a bad file surfaces as
 * a named error instead of a quietly modified icon.
 */

import { XMLParser } from "fast-xml-parser"
import { ValidationError } from "./errors"

const FORBIDDEN_TAGS = new Set(["script", "foreignobject"])
const DATA_IMAGE_HREF = /^data:image\//i

type XmlNode = Record<string, unknown>

function isAllowedHref(value: string): boolean {
  return value.startsWith("#") || DATA_IMAGE_HREF.test(value)
}

function walk(node: unknown, fileName: string): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, fileName)
    return
  }
  if (!node || typeof node !== "object") return

  for (const [key, value] of Object.entries(node as XmlNode)) {
    if (key.startsWith("@_")) {
      const attr = key.slice(2).toLowerCase()
      if (attr.startsWith("on"))
        throw new ValidationError(
          `'${fileName}' contient un attribut interdit '${attr}'.`
        )
      if (
        (attr === "href" || attr === "xlink:href") &&
        typeof value === "string" &&
        !isAllowedHref(value)
      )
        throw new ValidationError(
          `'${fileName}' référence une ressource externe interdite via '${attr}'.`
        )
      continue
    }
    if (FORBIDDEN_TAGS.has(key.toLowerCase()))
      throw new ValidationError(
        `'${fileName}' contient une balise interdite '<${key}>'.`
      )
    walk(value, fileName)
  }
}

/** Throws ValidationError if `svg` isn't safe to store and serve verbatim. */
export function sanitizeSvg(svg: string, fileName: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    ignoreDeclaration: true,
  })

  let parsed: XmlNode
  try {
    parsed = parser.parse(svg) as XmlNode
  } catch {
    throw new ValidationError(`'${fileName}' n'est pas un document XML valide.`)
  }

  const rootKey = Object.keys(parsed)[0]
  if (Object.keys(parsed).length !== 1 || rootKey?.toLowerCase() !== "svg")
    throw new ValidationError(
      `'${fileName}' doit avoir <svg> comme élément racine unique.`
    )

  walk(parsed[rootKey], fileName)
  return svg
}
