/**
 * Regenerates the default ArchiMate type icons from the SVG files in
 * packages/image-library/assets/archimate/ (one file per ArchiMate type,
 * named {ArchimateType}.svg) — that folder is the source of truth for the
 * icons' artwork, hand-authored or exported from draw.io.
 *
 * For each of ArchiMate 3.1's canonical types (borrowed, as a read-only
 * type list, from lib/archimate/archimate-icons.ts plus PACK_ONLY_TYPES —
 * never ARCHIMATE_ICONS' glyph data, which only feeds the server SVG
 * renderer's corner icon and is unrelated to these default node icons),
 * reads the matching asset file, converts it to a self-contained TSX
 * component, and writes it under packages/image-library/src/archimate-icons/
 * alongside a regenerated barrel. These icons are compiled into
 * @workspace/image-library and imported directly at runtime by the
 * ReactFlow canvas — there is no database pack backing them.
 *
 * Run via `pnpm --filter server gen:icon-pack`. Fails loudly if an asset
 * file is missing for a canonical type, or if assets/archimate/ contains a
 * file matching no canonical type (see IGNORED_ASSET_FILES for known
 * orphans that are intentionally skipped).
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { XMLParser } from "fast-xml-parser"
import * as prettier from "prettier"
import { ARCHIMATE_ICONS } from "../lib/archimate/archimate-icons"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const IMAGE_LIBRARY_DIR = path.join(ROOT, "packages/image-library")
const ASSETS_DIR = path.join(IMAGE_LIBRARY_DIR, "assets/archimate")
const ICONS_SRC_DIR = path.join(IMAGE_LIBRARY_DIR, "src/archimate-icons")

const PRETTIER_OPTIONS: prettier.Options = {
  parser: "typescript",
  semi: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
}

// Manual backups or scratch files in assets/archimate/ that don't correspond
// to a real ArchiMate type — never treated as icon input.
const IGNORED_ASSET_FILES = new Set(["Resource_old.svg"])

// Types with an icon but no entry in ARCHIMATE_ICONS: Value has no
// corner-glyph notation in the server SVG renderer, but it's still a valid
// default icon once an asset file is provided for it.
const PACK_ONLY_TYPES = ["Value"]

function splitWords(type: string): string[] {
  return type.match(/[A-Z][a-z0-9]*/g) ?? [type]
}

function toSlug(type: string): string {
  return splitWords(type)
    .map((w) => w.toLowerCase())
    .join("-")
}

function toName(type: string): string {
  return splitWords(type).join(" ")
}

function toPascal(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
}

function checkCoverage(types: string[]): void {
  const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".svg"))
  const expected = new Set(types.map((t) => `${t}.svg`))

  const missing = types.filter((t) => !files.includes(`${t}.svg`))
  if (missing.length > 0) {
    throw new Error(
      `Missing assets/archimate/{Type}.svg for: ${missing.join(", ")}`
    )
  }

  const unexpected = files.filter(
    (f) => !expected.has(f) && !IGNORED_ASSET_FILES.has(f)
  )
  if (unexpected.length > 0) {
    throw new Error(
      `assets/archimate/ has file(s) matching no ArchiMate type: ` +
        `${unexpected.join(", ")}. Rename to match the type exactly, or add ` +
        `to IGNORED_ASSET_FILES if intentional.`
    )
  }
}

// ---------------------------------------------------------------------------
// SVG (draw.io export or hand-authored) -> JSX conversion
// ---------------------------------------------------------------------------

const ATTR_KEY = ":@"
const TEXT_KEY = "#text"

// Editor/tooling metadata that carries no rendering meaning: draw.io's
// embedded project file, the interactivity hint it adds to every shape, and
// its per-cell bookkeeping id.
const DROP_ATTRS = new Set([
  "xmlns",
  "xmlns:xlink",
  "version",
  "content",
  "data-cell-id",
  "pointer-events",
])

// draw.io always wraps a shape's (here always empty, value="") text label in
// a <switch> offering an HTML <foreignObject> rendering with a raster
// <image> fallback — no ArchiMate icon in this set has a label, so this
// subtree never carries visible content and is dropped outright.
const DROP_TAGS = new Set(["switch", "foreignObject"])

const CAMEL_CASE_ATTRS: Record<string, string> = {
  "stroke-width": "strokeWidth",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-linecap": "strokeLinecap",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "clip-path": "clipPath",
}

function attrName(name: string): string {
  return CAMEL_CASE_ATTRS[name] ?? name
}

function kebabToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** "fill: rgb(0,0,0); stroke: light-dark(...)" -> { fill: "...", stroke: "..." } */
function parseStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":")
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim()
    const value = decl.slice(idx + 1).trim()
    if (!prop || !value) continue
    out[kebabToCamel(prop)] = value
  }
  return out
}

function serializeElement(
  tagName: string,
  attrs: Record<string, string>,
  childrenJsx: string[],
  options: { isRoot: boolean }
): string {
  const parts: string[] = []
  let styleObj: Record<string, string> | null = null

  for (const [rawName, rawValue] of Object.entries(attrs)) {
    const name = rawName.slice(2) // strip the "@_" prefix fast-xml-parser adds
    if (DROP_ATTRS.has(name)) continue
    if (
      options.isRoot &&
      (name === "style" || name === "width" || name === "height")
    )
      continue // editor-preview cosmetics / fixed pixel sizing — icons scale via props
    if (name === "style") {
      styleObj = parseStyle(rawValue)
      continue
    }
    parts.push(`${attrName(name)}=${JSON.stringify(rawValue)}`)
  }

  if (styleObj) {
    // The inline style (with its light-dark() values) supersedes the plain
    // fill/stroke presentation attributes draw.io also emits — keep one.
    const kept = parts.filter(
      (p) => !p.startsWith("fill=") && !p.startsWith("stroke=")
    )
    parts.length = 0
    parts.push(...kept)
    const styleEntries = Object.entries(styleObj)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ")
    parts.push(`style={{ ${styleEntries} }}`)
  }

  if (options.isRoot) parts.push("{...props}")

  const attrsStr = parts.length > 0 ? " " + parts.join(" ") : ""
  if (childrenJsx.length === 0) return `<${tagName}${attrsStr} />`
  return `<${tagName}${attrsStr}>${childrenJsx.join("")}</${tagName}>`
}

function walk(nodes: unknown[]): string[] {
  const out: string[] = []
  for (const raw of nodes) {
    const node = raw as Record<string, unknown>
    const tagKey = Object.keys(node).find((k) => k !== ATTR_KEY)
    if (!tagKey || tagKey === TEXT_KEY) continue
    if (DROP_TAGS.has(tagKey)) continue

    const rawChildren = node[tagKey] as unknown[]
    const attrs = (node[ATTR_KEY] as Record<string, string>) ?? {}
    const childrenJsx = walk(rawChildren)

    if (tagKey === "defs" && childrenJsx.length === 0) continue
    if (tagKey === "g" && childrenJsx.length === 0) continue // empty draw.io cell

    const meaningfulAttrCount = Object.keys(attrs).filter(
      (k) => !DROP_ATTRS.has(k.slice(2))
    ).length
    if (tagKey === "g" && meaningfulAttrCount === 0) {
      // Pass-through wrapper (draw.io nests every shape several <g> deep) —
      // inline its children directly instead of an empty <g>.
      out.push(...childrenJsx)
      continue
    }

    out.push(serializeElement(tagKey, attrs, childrenJsx, { isRoot: false }))
  }
  return out
}

function svgToJsxBody(svgSource: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    attributesGroupName: ATTR_KEY,
    preserveOrder: true,
    parseAttributeValue: false,
    ignoreDeclaration: true,
  })
  const parsed = parser.parse(svgSource) as Record<string, unknown>[]
  const svgNode = parsed.find((n) => "svg" in n)
  if (!svgNode) throw new Error("No <svg> root element found")

  const svgAttrs = (svgNode[ATTR_KEY] as Record<string, string>) ?? {}
  const svgChildren = svgNode["svg"] as unknown[]
  return serializeElement("svg", svgAttrs, walk(svgChildren), { isRoot: true })
}

async function main(): Promise<void> {
  const types = [...Object.keys(ARCHIMATE_ICONS), ...PACK_ONLY_TYPES].sort()
  checkCoverage(types)

  rmSync(ICONS_SRC_DIR, { recursive: true, force: true })
  mkdirSync(ICONS_SRC_DIR, { recursive: true })

  const barrelImports: string[] = []
  const iconEntries: string[] = []
  const nameEntries: string[] = []

  for (const type of types) {
    const slug = toSlug(type)
    const name = toName(type)
    const pascal = toPascal(slug)
    const componentName = `${pascal}Icon`
    const svg = readFileSync(
      path.join(ASSETS_DIR, `${type}.svg`),
      "utf8"
    ).trim()

    const jsxBody = svgToJsxBody(svg)
    const moduleSrc = `import type { SVGProps } from "react"

export function ${componentName}(props: SVGProps<SVGSVGElement>) {
  return ${jsxBody}
}
`
    const formatted = await prettier.format(moduleSrc, PRETTIER_OPTIONS)
    writeFileSync(path.join(ICONS_SRC_DIR, `${slug}.tsx`), formatted)

    barrelImports.push(`import { ${componentName} } from "./${slug}.js"`)
    iconEntries.push(`${JSON.stringify(type)}: ${componentName}`)
    nameEntries.push(`${JSON.stringify(type)}: ${JSON.stringify(name)}`)
  }

  const barrelSrc = `${barrelImports.join("\n")}
import type { ArchimateIconComponent } from "../types.js"

export const ARCHIMATE_TYPE_ICONS: Record<string, ArchimateIconComponent> = {
  ${iconEntries.join(",\n  ")},
}

export const ARCHIMATE_TYPE_NAMES: Record<string, string> = {
  ${nameEntries.join(",\n  ")},
}

export function getArchimateTypeIcon(
  type: string
): ArchimateIconComponent | undefined {
  return ARCHIMATE_TYPE_ICONS[type]
}
`
  const formattedBarrel = await prettier.format(barrelSrc, PRETTIER_OPTIONS)
  writeFileSync(path.join(ICONS_SRC_DIR, "index.ts"), formattedBarrel)

  console.log(
    `Regenerated ${types.length} icon components into ${ICONS_SRC_DIR}.`
  )
}

main()
