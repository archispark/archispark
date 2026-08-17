/**
 * Generator for the AWS / Azure / GCP system image packs.
 *
 * Reads the vendor icon sets from a local --source directory (not part of
 * the repo — point it at a folder containing AWS/, Azure/, GCP/ subfolders
 * with the official AWS Architecture Icons, Microsoft Azure service icons,
 * and Google Cloud product icons), normalizes filenames into stable slugs
 * (see lib/cloud-icon-slug.ts), and always rewrites the committed asset
 * files under packages/image-library/assets/<vendor>/.
 *
 * The original seed migration per vendor (0027/0028/0029_image_pack_*.sql)
 * is written once and never rewritten afterwards — it has already run on
 * every deployed database. On later runs, each vendor's new normalized
 * content is diffed against its previously committed asset file: a new icon
 * becomes an INSERT, a changed one an UPDATE, both written to a fresh
 * incremental migration (same pattern as generate-archimate-icon-pack.ts) —
 * only if something actually changed for that vendor.
 *
 * Run via `pnpm --filter server gen:cloud-icon-packs -- --source <dir>`.
 * Not part of the build — its output is committed to the repo like any
 * other source file.
 */

import { randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import {
  normalizeAwsIcons,
  normalizeAzureIcons,
  normalizeGcpIcons,
  type CloudIcon,
  type SourceFile,
} from "./lib/cloud-icon-slug"
import { nextMigrationFile, appendJournalEntry } from "./lib/migration-journal"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const IMAGE_LIBRARY_DIR = path.join(ROOT, "packages/image-library")
const MIGRATIONS_DIR = path.join(ROOT, "packages/db/drizzle-pg")

interface Vendor {
  slug: string
  sourceDir: string
  packName: string
  description: string
  migrationFile: string
  normalize: (files: SourceFile[]) => CloudIcon[]
}

const VENDORS: Vendor[] = [
  {
    slug: "aws",
    sourceDir: "AWS",
    packName: "AWS Icons",
    description:
      "Official AWS Architecture Service Icons, for use in ReactFlow diagrams.",
    migrationFile: "0027_image_pack_aws.sql",
    normalize: normalizeAwsIcons,
  },
  {
    slug: "azure",
    sourceDir: "Azure",
    packName: "Azure Icons",
    description:
      "Official Microsoft Azure service icons, for use in ReactFlow diagrams.",
    migrationFile: "0028_image_pack_azure.sql",
    normalize: normalizeAzureIcons,
  },
  {
    slug: "gcp",
    sourceDir: "GCP",
    packName: "GCP Icons",
    description:
      "Official Google Cloud product icons, for use in ReactFlow diagrams.",
    migrationFile: "0029_image_pack_gcp.sql",
    normalize: normalizeGcpIcons,
  },
]

function parseSourceArg(): string {
  const flagIndex = process.argv.indexOf("--source")
  const value = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined
  if (!value) {
    throw new Error(
      "Missing --source <dir>: path to the folder containing AWS/, Azure/, GCP/ subfolders."
    )
  }
  return path.resolve(value.replace(/^~/, process.env["HOME"] ?? "~"))
}

function readSvgFiles(dir: string): SourceFile[] {
  return readdirSync(dir)
    .filter((filename) => filename.toLowerCase().endsWith(".svg"))
    .map((filename) => ({
      filename,
      content: readFileSync(path.join(dir, filename), "utf8"),
    }))
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''")
}

function buildSeedMigrationSql(vendor: Vendor, icons: CloudIcon[]): string {
  const packUuid = randomUUID()
  const itemInserts = icons.map((icon) => itemInsertSql(vendor, icon))

  return (
    `INSERT INTO "image_packs" ("uuid", "organization_id", "is_system", "slug", "name", "description")\n` +
    `VALUES ('${packUuid}', NULL, true, '${vendor.slug}', '${sqlEscape(vendor.packName)}', '${sqlEscape(vendor.description)}')\n` +
    `ON CONFLICT DO NOTHING;\n` +
    `--> statement-breakpoint\n` +
    `${itemInserts.join("\n--> statement-breakpoint\n")}\n`
  )
}

function itemInsertSql(vendor: Vendor, icon: CloudIcon): string {
  const itemUuid = randomUUID()
  return (
    `INSERT INTO "image_pack_items" ` +
    `("uuid", "pack_id", "slug", "name", "storage_kind", "svg_content") ` +
    `SELECT '${itemUuid}', "id", '${sqlEscape(icon.slug)}', '${sqlEscape(icon.name)}', ` +
    `'inline_svg', '${sqlEscape(icon.content)}' ` +
    `FROM "image_packs" WHERE "slug" = '${vendor.slug}' AND "organization_id" IS NULL ` +
    `ON CONFLICT ("pack_id", "slug") DO NOTHING;`
  )
}

function itemUpdateSql(vendor: Vendor, icon: CloudIcon): string {
  return (
    `UPDATE "image_pack_items" AS ipi\n` +
    `SET "svg_content" = '${sqlEscape(icon.content)}'\n` +
    `FROM "image_packs" AS ip\n` +
    `WHERE ipi."pack_id" = ip."id"\n` +
    `  AND ip."slug" = '${vendor.slug}'\n` +
    `  AND ip."organization_id" IS NULL\n` +
    `  AND ipi."slug" = '${sqlEscape(icon.slug)}';`
  )
}

/** Prior content of an already-committed asset file, or null on first run. */
function existingAssetSvg(assetsDir: string, slug: string): string | null {
  const file = path.join(assetsDir, `${slug}.svg`)
  if (!existsSync(file)) return null
  return readFileSync(file, "utf8").trim()
}

function main(): void {
  const sourceRoot = parseSourceArg()

  for (const vendor of VENDORS) {
    const sourceDir = path.join(sourceRoot, vendor.sourceDir)
    const files = readSvgFiles(sourceDir)
    const icons = vendor
      .normalize(files)
      .sort((a, b) => a.slug.localeCompare(b.slug))

    const assetsDir = path.join(IMAGE_LIBRARY_DIR, "assets", vendor.slug)
    mkdirSync(assetsDir, { recursive: true })

    const seedMigrationPath = path.join(MIGRATIONS_DIR, vendor.migrationFile)
    const isFirstRun = !existsSync(seedMigrationPath)

    const changedUpdates: string[] = []
    for (const icon of icons) {
      const priorSvg = existingAssetSvg(assetsDir, icon.slug)
      writeFileSync(
        path.join(assetsDir, `${icon.slug}.svg`),
        icon.content + "\n"
      )
      if (isFirstRun) continue // covered by the full seed write below
      if (priorSvg === null) changedUpdates.push(itemInsertSql(vendor, icon))
      else if (priorSvg !== icon.content)
        changedUpdates.push(itemUpdateSql(vendor, icon))
    }

    if (isFirstRun) {
      writeFileSync(seedMigrationPath, buildSeedMigrationSql(vendor, icons))
      console.log(
        `[${vendor.slug}] ${files.length} source files -> ${icons.length} icons ` +
          `(${assetsDir}, ${seedMigrationPath})`
      )
      continue
    }

    if (changedUpdates.length === 0) {
      console.log(
        `[${vendor.slug}] ${files.length} source files -> ${icons.length} icons; ` +
          `no svg_content changes, no migration written.`
      )
      continue
    }

    const { file, tag, idx } = nextMigrationFile(
      MIGRATIONS_DIR,
      `sync_${vendor.slug}_icon_pack_assets`
    )
    const migrationSql =
      `-- Syncs image_pack_items for the system "${vendor.packName}" pack from\n` +
      `-- packages/image-library/assets/${vendor.slug}/*.svg (see\n` +
      `-- apps/server/scripts/generate-cloud-icon-packs.ts). Never touches\n` +
      `-- ${vendor.migrationFile}, which seeds the pack and its original rows once.\n` +
      changedUpdates.join("\n--> statement-breakpoint\n") +
      "\n"
    writeFileSync(file, migrationSql)
    appendJournalEntry(MIGRATIONS_DIR, idx, tag)

    console.log(
      `[${vendor.slug}] ${files.length} source files -> ${icons.length} icons; ` +
        `wrote ${file} (${changedUpdates.length} icon(s) changed).`
    )
  }
}

main()
