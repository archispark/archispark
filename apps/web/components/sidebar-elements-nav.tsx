"use client"

import Link from "next/link"
import { LAYER_HEX_COLORS, LAYER_LABELS } from "@/lib/archimate-helpers"
import type { ModelInfo } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { Section } from "@/components/sidebar-section"
import { List } from "lucide-react"

interface LayerGroup {
  key: string
  label: string
  dot: string
}

const LAYER_GROUPS: LayerGroup[] = Object.entries(LAYER_HEX_COLORS).map(
  ([key, dot]) => ({
    key,
    dot,
    label: LAYER_LABELS[key] ?? key,
  })
)

/** Elements nav section: link to the list plus one entry per ArchiMate layer. */
export function ElementsNavSection({
  pathname,
  currentLayer,
  onClose,
  model,
  absentCount,
  layerCounts,
  t,
}: {
  pathname: string
  currentLayer: string | null
  onClose: () => void
  model: ModelInfo | undefined
  absentCount: number
  layerCounts: Record<string, number>
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <Section title={t("sidebar.elements")}>
      {/* Always-available entry to the elements list (and its create dialog),
          even for an empty model where no layer link would otherwise show. */}
      <Link
        href="/elements"
        onClick={onClose}
        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
          pathname === "/elements" && !currentLayer
            ? "bg-card font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <List className="size-3.5 shrink-0" />
          {t("sidebar.list")}
        </span>
        <span className="flex items-center gap-1">
          {model && (
            <span className="text-[11px] text-muted-foreground">
              {model.element_count}
            </span>
          )}
          {absentCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1 text-[10px] font-bold text-amber-600">
              {absentCount}
            </span>
          )}
        </span>
      </Link>
      {LAYER_GROUPS.map((group) => {
        const active = pathname === "/elements" && currentLayer === group.key
        return (
          <Link
            key={group.key}
            href={`/elements?layer=${group.key}`}
            onClick={onClose}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
              active
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: group.dot }}
              />
              {t(`layer.${group.key}` as Parameters<typeof t>[0]) ||
                group.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {layerCounts[group.key] || 0}
            </span>
          </Link>
        )
      })}
    </Section>
  )
}
