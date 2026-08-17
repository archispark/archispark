/**
 * Syncs the "ArchiMate Notation" system image pack from the SVG files in
 * packages/image-library/assets/archimate/ (one file per ArchiMate type,
 * named {ArchimateType}.svg) — that folder is the source of truth for the
 * pack's artwork, hand-authored or exported from draw.io.
 *
 * For each of ArchiMate 3.1's canonical types (borrowed, as a read-only
 * type list, from lib/archimate/archimate-icons.ts plus PACK_ONLY_TYPES —
 * never ARCHIMATE_ICONS' glyph data, which only feeds the server SVG
 * renderer's corner icon and is unrelated to this pack), reads the matching
 * asset file verbatim and regenerates:
 *   - one module per icon + a barrel under packages/image-library/src/system-icons/
 *   - an incremental migration under packages/db/drizzle-pg/ — INSERT for a
 *     type with no existing pack item, UPDATE for one whose svg content
 *     changed — covering only what actually changed since the last run. The
 *     original seed, 0023_image_packs.sql, is never rewritten — it has
 *     already run everywhere.
 *
 * Run via `pnpm --filter server gen:icon-pack`. Fails loudly if an asset
 * file is missing for a canonical type, or if assets/archimate/ contains a
 * file matching no canonical type (see IGNORED_ASSET_FILES for known
 * orphans that are intentionally skipped).
 */

import { randomUUID } from "node:crypto"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { ARCHIMATE_ICONS } from "../lib/archimate/archimate-icons"
import { nextMigrationFile, appendJournalEntry } from "./lib/migration-journal"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const IMAGE_LIBRARY_DIR = path.join(ROOT, "packages/image-library")
const ASSETS_DIR = path.join(IMAGE_LIBRARY_DIR, "assets/archimate")
const ICONS_SRC_DIR = path.join(IMAGE_LIBRARY_DIR, "src/system-icons")
const MIGRATIONS_DIR = path.join(ROOT, "packages/db/drizzle-pg")

// Manual backups or scratch files in assets/archimate/ that don't correspond
// to a real ArchiMate type — never treated as pack input.
const IGNORED_ASSET_FILES = new Set(["Resource_old.svg"])

// Types with a pack icon but no entry in ARCHIMATE_ICONS: Value has no
// corner-glyph notation in the server SVG renderer, but it's still a valid
// pack icon once an asset file is provided for it.
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

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''")
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

/** Prior svg content of an already-generated module, or null on first run. */
function existingModuleSvg(slug: string): string | null {
  let src: string
  try {
    src = readFileSync(path.join(ICONS_SRC_DIR, `${slug}.ts`), "utf8")
  } catch {
    return null
  }
  const match = /svg: (".*"),\n}/.exec(src)
  return match ? (JSON.parse(match[1]!) as string) : null
}

function main(): void {
  const types = [...Object.keys(ARCHIMATE_ICONS), ...PACK_ONLY_TYPES].sort()
  checkCoverage(types)

  const barrelImports: string[] = []
  const barrelLines: string[] = []
  const changedUpdates: string[] = []

  for (const type of types) {
    const slug = toSlug(type)
    const name = toName(type)
    const svg = readFileSync(
      path.join(ASSETS_DIR, `${type}.svg`),
      "utf8"
    ).trim()
    const camel = slug.replace(/-([a-z0-9])/g, (_, c: string) =>
      c.toUpperCase()
    )

    const priorSvg = existingModuleSvg(slug)
    if (priorSvg === null) {
      const itemUuid = randomUUID()
      changedUpdates.push(
        `INSERT INTO "image_pack_items" ` +
          `("uuid", "pack_id", "slug", "name", "archimate_type", "storage_kind", "svg_content") ` +
          `SELECT '${itemUuid}', "id", '${sqlEscape(slug)}', '${sqlEscape(name)}', ` +
          `'${sqlEscape(type)}', 'inline_svg', '${sqlEscape(svg)}' ` +
          `FROM "image_packs" WHERE "slug" = 'archimate' AND "organization_id" IS NULL ` +
          `ON CONFLICT ("pack_id", "slug") DO NOTHING;`
      )
    } else if (priorSvg !== svg) {
      changedUpdates.push(
        `UPDATE "image_pack_items" AS ipi\n` +
          `SET "svg_content" = '${sqlEscape(svg)}'\n` +
          `FROM "image_packs" AS ip\n` +
          `WHERE ipi."pack_id" = ip."id"\n` +
          `  AND ip."slug" = 'archimate'\n` +
          `  AND ip."organization_id" IS NULL\n` +
          `  AND ipi."slug" = '${sqlEscape(slug)}';`
      )
    }

    const moduleSrc = `import type { SystemArchimateIcon } from "../types.js"

export const ${camel}: SystemArchimateIcon = {
  slug: ${JSON.stringify(slug)},
  name: ${JSON.stringify(name)},
  archimateType: ${JSON.stringify(type)},
  svg: ${JSON.stringify(svg)},
}
`
    writeFileSync(path.join(ICONS_SRC_DIR, `${slug}.ts`), moduleSrc)

    barrelImports.push(`import { ${camel} } from "./${slug}.js"`)
    barrelLines.push(camel)
  }

  const barrelSrc = `${barrelImports.join("\n")}
import type { SystemArchimateIcon } from "../types.js"

export const SYSTEM_ARCHIMATE_ICONS: SystemArchimateIcon[] = [
  ${barrelLines.join(",\n  ")},
]

export function getSystemArchimateIcon(
  slug: string
): SystemArchimateIcon | undefined {
  return SYSTEM_ARCHIMATE_ICONS.find((icon) => icon.slug === slug)
}
`
  writeFileSync(path.join(ICONS_SRC_DIR, "index.ts"), barrelSrc)

  if (changedUpdates.length === 0) {
    console.log(
      `Regenerated ${types.length} icon modules into ${ICONS_SRC_DIR}; ` +
        `no svg_content changes, no migration written.`
    )
    return
  }

  const { file, tag, idx } = nextMigrationFile(
    MIGRATIONS_DIR,
    "sync_archimate_icon_pack_assets"
  )
  const migrationSql =
    `-- Syncs image_pack_items for the system "ArchiMate Notation" pack from\n` +
    `-- packages/image-library/assets/archimate/*.svg (see\n` +
    `-- apps/server/scripts/generate-archimate-icon-pack.ts). Never touches\n` +
    `-- 0023_image_packs.sql, which seeds the pack and its original rows once.\n` +
    changedUpdates.join("\n--> statement-breakpoint\n") +
    "\n"
  writeFileSync(file, migrationSql)
  appendJournalEntry(MIGRATIONS_DIR, idx, tag)

  console.log(
    `Regenerated ${types.length} icon modules into ${ICONS_SRC_DIR}; ` +
      `wrote ${file} (${changedUpdates.length} icon(s) changed).`
  )
}

main()
