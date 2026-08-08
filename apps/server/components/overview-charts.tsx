"use client"

import {
  getLayer,
  LAYER_HEX_COLORS as LAYER_COLORS,
} from "@/lib/archimate-helpers"
import type { ElementOut, RelationshipOut } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { DonutChart, type SliceData } from "@/components/donut-chart"

export function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: number
  color?: string
  sub?: { label: string; value: number; total: number; color: string }
}) {
  const okRatio =
    sub && sub.total > 0 ? Math.min((sub.total - sub.value) / sub.total, 1) : 1
  const hasError = sub ? sub.value > 0 : false
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${okRatio * 100}%`,
                backgroundColor: hasError ? sub.color : "#10b981",
              }}
            />
          </div>
          {hasError && (
            <div
              className="text-[10px] font-medium"
              style={{ color: sub.color }}
            >
              {sub.value} {sub.label}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Donut pie chart — generic, no external dependency
// ---------------------------------------------------------------------------

const TOP_N = 14

const RELATIONSHIP_COLORS: Record<string, string> = {
  Composition: "#2563eb",
  Aggregation: "#7c3aed",
  Assignment: "#0891b2",
  Realization: "#0d9488",
  Serving: "#16a34a",
  Access: "#059669",
  Influence: "#d97706",
  Triggering: "#ea580c",
  Flow: "#dc2626",
  Association: "#64748b",
  Specialization: "#db2777",
}

export function TypePieChart({ elements }: { elements: ElementOut[] }) {
  const { t } = useT()

  const typeCounts = elements.reduce<Record<string, number>>((acc, el) => {
    acc[el.type] = (acc[el.type] || 0) + 1
    return acc
  }, {})

  const total = elements.length
  const sorted = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)
  const top = sorted.slice(0, TOP_N)
  const restCount = sorted.slice(TOP_N).reduce((s, [, c]) => s + c, 0)

  const data: SliceData[] = top.map(([type, count]) => ({
    label: type,
    count,
    color: LAYER_COLORS[getLayer(type)] ?? "#94a3b8",
  }))
  if (restCount > 0) {
    data.push({
      label: t("overview.other"),
      count: restCount,
      color: "#94a3b8",
    })
  }

  return (
    <div>
      <div className="mb-3 text-[11px] font-bold tracking-[0.6px] text-muted-foreground uppercase">
        {t("overview.elements_by_type")}
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <DonutChart
          data={data}
          total={total}
          centerLabel={t("overview.total_elements")}
        />
      </div>
    </div>
  )
}

export function RelPieChart({
  relationships,
}: {
  relationships: RelationshipOut[]
}) {
  const { t } = useT()

  const typeCounts = relationships.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1
    return acc
  }, {})

  const total = relationships.length
  const sorted = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)
  const top = sorted.slice(0, TOP_N)
  const restCount = sorted.slice(TOP_N).reduce((s, [, c]) => s + c, 0)

  const data: SliceData[] = top.map(([type, count]) => ({
    label: type,
    count,
    color: RELATIONSHIP_COLORS[type] ?? "#94a3b8",
  }))
  if (restCount > 0) {
    data.push({
      label: t("overview.other"),
      count: restCount,
      color: "#94a3b8",
    })
  }

  return (
    <div>
      <div className="mb-3 text-[11px] font-bold tracking-[0.6px] text-muted-foreground uppercase">
        {t("overview.relationships_by_type")}
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <DonutChart
          data={data}
          total={total}
          centerLabel={t("overview.relationships")}
        />
      </div>
    </div>
  )
}
