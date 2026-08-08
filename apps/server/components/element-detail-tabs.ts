import type { useT } from "@/lib/i18n"

/** Tab bar config for the element detail page. */
export function buildElementTabs({
  t,
  relCount,
  propCount,
  viewCount,
}: {
  t: ReturnType<typeof useT>["t"]
  relCount: number
  propCount: number
  viewCount: number
}) {
  return [
    { id: "canvas", label: t("elements.tab_canvas") },
    { id: "relations", label: t("elements.tab_relations"), count: relCount },
    {
      id: "properties",
      label: t("elements.tab_properties"),
      count: propCount,
    },
    { id: "views", label: t("elements.tab_views"), count: viewCount },
  ]
}
