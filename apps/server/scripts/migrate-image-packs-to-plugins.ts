/**
 * ONE-SHOT migration script — run once (`pnpm --filter server tsx
 * scripts/migrate-image-packs-to-plugins.ts`) to bootstrap plugins/{aws,
 * azure,gcp}/ from the DB-backed vendor packs being retired by
 * packages/db/drizzle-pg/0043_plugins.sql. Its output (plugins/**) is what
 * gets committed; this script itself can be deleted afterwards or kept as
 * historical reference.
 *
 * Icon slugs are derived from each asset file's name (minus .svg) — this
 * MUST match the slugs already stored as image_pack_items.slug in
 * production (see itemInsertSql in generate-cloud-icon-packs.ts, which
 * already uses the slug as the asset filename), so existing
 * Archispark Plugin IconPack values keep resolving after
 * 0043_plugins.sql drops image_pack_items.
 * Names come from the original seed migrations (0027/0028/0029), the only
 * place that ever recorded a human-readable name per icon — the source SVGs
 * used to generate those (an external, non-committed folder) are no longer
 * available to re-derive them from.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const ASSETS_DIR = path.join(ROOT, "packages/image-library/assets")
const MIGRATIONS_DIR = path.join(ROOT, "packages/db/drizzle-pg")
const PLUGINS_DIR = path.join(ROOT, "plugins")

interface Vendor {
  slug: string
  name: string
  description: string
  seedMigrationFile: string
}

// packages/db/drizzle-pg/0042_drop_archimate_image_pack.sql disambiguated 3
// slug collisions between vendor packs by renaming the losing item's *DB
// row* — never the committed asset filename it was generated from, which
// still uses the original (collided) name. Filename-derived slugs must be
// overridden for exactly these 3 icons to match what's already live in
// production as Archispark Plugin IconPack values (see that migration's
// step 4).
const SLUG_OVERRIDES: Record<string, Record<string, string>> = {
  azure: {
    "resource-explorer": "azure-resource-explorer",
    "savings-plans": "azure-savings-plans",
    marketplace: "gcp-marketplace",
  },
}

const VENDORS: Vendor[] = [
  {
    slug: "aws",
    name: "AWS Icons",
    description:
      "Official AWS Architecture Service Icons, for use in ReactFlow diagrams.",
    seedMigrationFile: "0027_image_pack_aws.sql",
  },
  {
    slug: "azure",
    name: "Azure Icons",
    description:
      "Official Microsoft Azure service icons, for use in ReactFlow diagrams.",
    seedMigrationFile: "0028_image_pack_azure.sql",
  },
  {
    slug: "gcp",
    name: "GCP Icons",
    description:
      "Official Google Cloud product icons, for use in ReactFlow diagrams.",
    seedMigrationFile: "0029_image_pack_gcp.sql",
  },
]

/** Extracts { slug -> name } from an `image_pack_items` seed migration —
 *  the only surviving record of each icon's human-readable name. */
function extractSlugNamePairs(sql: string): Map<string, string> {
  const result = new Map<string, string>()
  const re =
    /INSERT INTO "image_pack_items"[^]*?SELECT\s+'[0-9a-f-]+',\s*"id",\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'inline_svg',/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sql))) {
    const slug = m[1]!.replace(/''/g, "'")
    const name = m[2]!.replace(/''/g, "'")
    result.set(slug, name)
  }
  return result
}

function main(): void {
  for (const vendor of VENDORS) {
    const seedSql = readFileSync(
      path.join(MIGRATIONS_DIR, vendor.seedMigrationFile),
      "utf8"
    )
    const namesBySlug = extractSlugNamePairs(seedSql)

    const srcAssetsDir = path.join(ASSETS_DIR, vendor.slug)
    const svgFiles = readdirSync(srcAssetsDir).filter((f) => f.endsWith(".svg"))

    const pluginDir = path.join(PLUGINS_DIR, vendor.slug)
    const iconsDir = path.join(pluginDir, "icons")
    mkdirSync(iconsDir, { recursive: true })

    const overrides = SLUG_OVERRIDES[vendor.slug] ?? {}
    const manifestIcons: string[] = []
    let missingNames = 0
    for (const file of svgFiles.sort()) {
      const fileSlug = file.slice(0, -4)
      const slug = overrides[fileSlug] ?? fileSlug
      const name = namesBySlug.get(fileSlug)
      if (!name) missingNames++
      copyFileSync(path.join(srcAssetsDir, file), path.join(iconsDir, file))
      manifestIcons.push(
        `  { slug: ${JSON.stringify(slug)}, name: ${JSON.stringify(name ?? slug)}, file: ${JSON.stringify(file)} },`
      )
    }
    if (missingNames > 0) {
      throw new Error(
        `[${vendor.slug}] ${missingNames} icon(s) have no matching name in ${vendor.seedMigrationFile} — aborting.`
      )
    }

    writeFileSync(
      path.join(pluginDir, "plugin.json"),
      JSON.stringify(
        {
          id: vendor.slug,
          name: vendor.name,
          version: "1.0.0",
          description: vendor.description,
          type: "icon-pack",
        },
        null,
        2
      ) + "\n"
    )

    writeFileSync(
      path.join(pluginDir, "manifest.ts"),
      `// Import of TYPE only, erased at compile time — never needs to be
// resolved at runtime. Relative path because plugins/ is not a pnpm
// workspace member (no @workspace/types specifier resolvable here).
import type { IconPluginManifest } from "../../packages/types/src/index"

const manifest: IconPluginManifest = {
  icons: [
${manifestIcons.join("\n")}
  ],
}

export default manifest
`
    )

    console.log(`[${vendor.slug}] ${svgFiles.length} icon(s) -> ${pluginDir}`)
  }
}

main()
