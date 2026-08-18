/**
 * Slug/name normalization for the AWS/Azure/GCP vendor icon sets consumed by
 * scripts/generate-cloud-icon-packs.ts. Each vendor ships its own filename
 * convention (see that script's header comment), so each gets a dedicated
 * normalizer; all three converge on the same `CloudIcon` shape.
 */

export interface SourceFile {
  filename: string
  content: string
}

export interface CloudIcon {
  slug: string
  name: string
  content: string
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function normalizeContent(content: string): string {
  return content.trim()
}

/** AWS: "API-Gateway.svg" -> slug "api-gateway", name "API Gateway". */
export function normalizeAwsIcons(files: SourceFile[]): CloudIcon[] {
  const icons: CloudIcon[] = []
  for (const file of files) {
    const base = file.filename.replace(/\.svg$/i, "")
    const name = collapseSpaces(base.replace(/[-_]+/g, " "))
    icons.push({ slug: toSlug(base), name, content: normalizeContent(file.content) })
  }
  return dedupeBySlug(icons, "aws")
}

const AZURE_FILENAME_RE = /^(\d+)\s*-icon-service-(.+)\.svg$/i

/**
 * Azure: "00001-icon-service-Monitor.svg" -> slug "monitor", name "Monitor".
 * Filenames carry a numeric ID prefix used only to disambiguate real
 * same-name/different-icon collisions (e.g. two distinct "Workspaces"
 * icons) — byte-identical duplicates are dropped instead.
 */
export function normalizeAzureIcons(files: SourceFile[]): CloudIcon[] {
  const bySlug = new Map<string, CloudIcon[]>()

  for (const file of files) {
    const match = AZURE_FILENAME_RE.exec(file.filename.trim())
    const id = match?.[1] ?? ""
    const rest = match?.[2] ?? file.filename.replace(/\.svg$/i, "")
    const name = collapseSpaces(rest.replace(/[-_]+/g, " "))
    const slug = toSlug(rest)
    const content = normalizeContent(file.content)

    const existing = bySlug.get(slug) ?? []
    if (existing.some((icon) => icon.content === content)) continue // exact duplicate
    const finalSlug = existing.length > 0 && id ? `${slug}-${id}` : slug
    const icon = { slug: finalSlug, name, content }
    existing.push(icon)
    bySlug.set(slug, existing)
  }

  return [...bySlug.values()].flat()
}

const GCP_SUFFIX_RE = /-512-color(-rgb)?$/i

/** GCP: "ComputeEngine-512-color-rgb.svg" -> slug "compute-engine", name "Compute Engine". */
export function normalizeGcpIcons(files: SourceFile[]): CloudIcon[] {
  const icons: CloudIcon[] = []
  for (const file of files) {
    const base = file.filename.replace(/\.svg$/i, "").replace(GCP_SUFFIX_RE, "")
    const spaced = base
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    const name = collapseSpaces(spaced)
    icons.push({ slug: toSlug(base), name, content: normalizeContent(file.content) })
  }
  return dedupeBySlug(icons, "gcp")
}

/** Drops exact-duplicate slugs (same normalized content); warns on real collisions. */
function dedupeBySlug(icons: CloudIcon[], vendor: string): CloudIcon[] {
  const bySlug = new Map<string, CloudIcon>()
  for (const icon of icons) {
    const existing = bySlug.get(icon.slug)
    if (!existing) {
      bySlug.set(icon.slug, icon)
    } else if (existing.content !== icon.content) {
      console.warn(
        `[${vendor}] slug collision for "${icon.slug}" with different content — keeping first, dropping "${icon.name}"`
      )
    }
  }
  return [...bySlug.values()]
}
