/**
 * One-shot generator for the "ArchiMate Notation" system image pack.
 *
 * Converts the vector glyphs in lib/archimate/archimate-icons.ts (already
 * used by the server-side SVG renderer) into standalone icons for the image
 * library: one SVG file + one TS module per ArchiMate type in
 * packages/image-library, plus the seed SQL for the pack and its 74 items in
 * packages/db/drizzle-pg/0023_image_packs.sql.
 *
 * Run once via `pnpm --filter server gen:icon-pack`. Not part of the build —
 * its output is committed to the repo like any other source file.
 */

import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { ARCHIMATE_ICONS, iconPrimSvg } from "../lib/archimate/archimate-icons"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const IMAGE_LIBRARY_DIR = path.join(ROOT, "packages/image-library")
const ASSETS_DIR = path.join(IMAGE_LIBRARY_DIR, "assets/archimate")
const ICONS_SRC_DIR = path.join(IMAGE_LIBRARY_DIR, "src/system-icons")
const MIGRATION_FILE = path.join(
  ROOT,
  "packages/db/drizzle-pg/0023_image_packs.sql"
)

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

function toSvg(type: string): string {
  const prims = ARCHIMATE_ICONS[type] ?? []
  const body = prims.map((p) => iconPrimSvg(p, "currentColor")).join("")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" ` +
    `stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" ` +
    `stroke-linecap="round"><g transform="translate(28 2)">${body}</g></svg>`
  )
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''")
}

function main(): void {
  mkdirSync(ASSETS_DIR, { recursive: true })
  mkdirSync(ICONS_SRC_DIR, { recursive: true })

  const types = Object.keys(ARCHIMATE_ICONS).sort()
  const barrelLines: string[] = []
  const barrelImports: string[] = []
  const itemInserts: string[] = []

  for (const type of types) {
    const slug = toSlug(type)
    const name = toName(type)
    const svg = toSvg(type)
    const camel = slug.replace(/-([a-z0-9])/g, (_, c: string) =>
      c.toUpperCase()
    )

    writeFileSync(path.join(ASSETS_DIR, `${type}.svg`), svg + "\n")

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

    const itemUuid = randomUUID()
    itemInserts.push(
      `INSERT INTO "image_pack_items" ` +
        `("uuid", "pack_id", "slug", "name", "archimate_type", "storage_kind", "svg_content") ` +
        `SELECT '${itemUuid}', "id", '${sqlEscape(slug)}', '${sqlEscape(name)}', ` +
        `'${sqlEscape(type)}', 'inline_svg', '${sqlEscape(svg)}' ` +
        `FROM "image_packs" WHERE "slug" = 'archimate' AND "organization_id" IS NULL ` +
        `ON CONFLICT ("pack_id", "slug") DO NOTHING;`
    )
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

  const packUuid = randomUUID()
  const migrationSql = `CREATE TABLE "image_packs" (
  "id" serial PRIMARY KEY NOT NULL,
  "uuid" text NOT NULL,
  "organization_id" integer REFERENCES "organizations"("id") ON DELETE CASCADE,
  "is_system" boolean DEFAULT false NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
  "updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_pack_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "uuid" text NOT NULL,
  "pack_id" integer NOT NULL REFERENCES "image_packs"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "archimate_type" text,
  "storage_kind" text NOT NULL,
  "svg_content" text,
  "blob_url" text,
  "blob_pathname" text,
  "mime_type" text,
  "created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "image_packs_uuid_uniq" ON "image_packs" ("uuid");
--> statement-breakpoint
CREATE UNIQUE INDEX "image_packs_system_slug_uniq" ON "image_packs" ("slug") WHERE "organization_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "image_packs_org_slug_uniq" ON "image_packs" ("organization_id", "slug") WHERE "organization_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "image_packs_org_idx" ON "image_packs" ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "image_pack_items_uuid_uniq" ON "image_pack_items" ("uuid");
--> statement-breakpoint
CREATE UNIQUE INDEX "image_pack_items_pack_slug_uniq" ON "image_pack_items" ("pack_id", "slug");
--> statement-breakpoint
CREATE INDEX "image_pack_items_pack_idx" ON "image_pack_items" ("pack_id");
--> statement-breakpoint
INSERT INTO "image_packs" ("uuid", "organization_id", "is_system", "slug", "name", "description")
VALUES ('${packUuid}', NULL, true, 'archimate', 'ArchiMate Notation', 'Standard ArchiMate 3.1 element icons, available to every organization.')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
${itemInserts.join("\n--> statement-breakpoint\n")}
`
  writeFileSync(MIGRATION_FILE, migrationSql)

  console.log(`Generated ${types.length} icons into ${IMAGE_LIBRARY_DIR}`)
  console.log(`Wrote migration ${MIGRATION_FILE}`)
}

main()
