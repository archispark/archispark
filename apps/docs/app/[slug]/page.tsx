import { notFound, redirect } from "next/navigation"

const docs = new Set([
  "archimate",
  "architecture",
  "authentication",
  "development",
  "getting-started",
  "mcp-tools",
  "user-guide",
])

export default async function LegacyDocPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params

  if (!docs.has(slug)) notFound()

  redirect(`/docs/${slug}`)
}
