/**
 * One-shot generator for the AWS / Azure / GCP system image packs.
 *
 * Reads the vendor icon sets from a local --source directory (not part of
 * the repo — point it at a folder containing AWS/, Azure/, GCP/ subfolders
 * with the official AWS Architecture Icons, Microsoft Azure service icons,
 * and Google Cloud product icons), normalizes filenames into stable slugs
 * (see lib/cloud-icon-slug.ts), and writes:
 *   - one SVG file per icon under packages/image-library/assets/<vendor>/
 *   - one seed migration per vendor under packages/db/drizzle-pg/
 *
 * Run once via `pnpm --filter server gen:cloud-icon-packs -- --source <dir>`.
 * Not part of the build — its output is committed to the repo like any
 * other source file, same as generate-archimate-icon-pack.ts.
 */

import { randomUUID } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  normalizeAwsIcons,
  normalizeAzureIcons,
  normalizeGcpIcons,
  type CloudIcon,
  type SourceFile,
} from "./lib/cloud-icon-slug"

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

function buildMigrationSql(vendor: Vendor, icons: CloudIcon[]): string {
  const packUuid = randomUUID()
  const itemInserts = icons.map((icon) => {
    const itemUuid = randomUUID()
    return (
      `INSERT INTO "image_pack_items" ` +
      `("uuid", "pack_id", "slug", "name", "storage_kind", "svg_content") ` +
      `SELECT '${itemUuid}', "id", '${sqlEscape(icon.slug)}', '${sqlEscape(icon.name)}', ` +
      `'inline_svg', '${sqlEscape(icon.content)}' ` +
      `FROM "image_packs" WHERE "slug" = '${vendor.slug}' AND "organization_id" IS NULL ` +
      `ON CONFLICT ("pack_id", "slug") DO NOTHING;`
    )
  })

  return (
    `INSERT INTO "image_packs" ("uuid", "organization_id", "is_system", "slug", "name", "description")\n` +
    `VALUES ('${packUuid}', NULL, true, '${vendor.slug}', '${sqlEscape(vendor.packName)}', '${sqlEscape(vendor.description)}')\n` +
    `ON CONFLICT DO NOTHING;\n` +
    `--> statement-breakpoint\n` +
    `${itemInserts.join("\n--> statement-breakpoint\n")}\n`
  )
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
    for (const icon of icons) {
      writeFileSync(
        path.join(assetsDir, `${icon.slug}.svg`),
        icon.content + "\n"
      )
    }

    const migrationPath = path.join(MIGRATIONS_DIR, vendor.migrationFile)
    writeFileSync(migrationPath, buildMigrationSql(vendor, icons))

    console.log(
      `[${vendor.slug}] ${files.length} source files -> ${icons.length} icons ` +
        `(${assetsDir}, ${migrationPath})`
    )
  }
}

main()
