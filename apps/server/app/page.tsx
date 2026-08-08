"use client"

import { useMemo } from "react"
import {
  useModel,
  useElements,
  useRelationships,
  useElementsInViews,
} from "@/lib/queries"
import {
  getLayer,
  LAYER_HEX_COLORS as LAYER_COLORS,
} from "@/lib/archimate-helpers"
import { allowedRelationships } from "@/lib/archimate-rules"
import { useT } from "@/lib/i18n"
import {
  StatCard,
  TypePieChart,
  RelPieChart,
} from "@/components/overview-charts"

export default function OverviewPage() {
  const { t } = useT()
  const { data: model, isLoading: modelLoading, error: modelError } = useModel()
  const { data: elements = [], isLoading: elementsLoading } = useElements()
  const { data: relationships = [], isLoading: relsLoading } =
    useRelationships()
  const { data: inViews = [] } = useElementsInViews()

  const loading = modelLoading || elementsLoading || relsLoading
  const error = modelError

  const layerCounts = elements.reduce<Record<string, number>>((acc, el) => {
    const layer = getLayer(el.type)
    acc[layer] = (acc[layer] || 0) + 1
    return acc
  }, {})

  const byId = useMemo(
    () => new Map(elements.map((e) => [e.identifier, e])),
    [elements]
  )
  const inViewsSet = useMemo(() => new Set(inViews), [inViews])

  const conflictingRels = useMemo(
    () =>
      relationships.filter((r) => {
        const src = byId.get(r.source)
        const tgt = byId.get(r.target)
        return !allowedRelationships(src?.type, tgt?.type).includes(r.type)
      }),
    [relationships, byId]
  )

  const absentElements = useMemo(
    () => elements.filter((e) => !inViewsSet.has(e.identifier)),
    [elements, inViewsSet]
  )

  const absentByLayer = useMemo(
    () =>
      absentElements.reduce<Record<string, number>>((acc, el) => {
        const layer = getLayer(el.type)
        acc[layer] = (acc[layer] || 0) + 1
        return acc
      }, {}),
    [absentElements]
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
        {t("common.loading")}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("common.error")} : {(error as Error).message}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("overview.api_hint")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl p-7">
      {model && (
        <div className="mb-6">
          <h1 className="text-lg font-semibold">{model.name}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {model.documentation || t("overview.archimate_model")}
            {model.version && <> · v{model.version}</>}
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="mb-3 text-[11px] font-bold tracking-[0.6px] text-muted-foreground uppercase">
        {t("overview.model_apercu")}
      </div>
      <div className="mb-7 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <StatCard
          label={t("overview.total_elements")}
          value={model?.element_count ?? 0}
          sub={{
            label: "absents des vues",
            value: absentElements.length,
            total: model?.element_count ?? 0,
            color: "#d97706",
          }}
        />
        {Object.entries(layerCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([layer, count]) => {
            const absent = absentByLayer[layer] ?? 0
            return (
              <StatCard
                key={layer}
                label={t(`layer.${layer}` as Parameters<typeof t>[0]) || layer}
                value={count}
                color={LAYER_COLORS[layer]}
                sub={{
                  label: "absents",
                  value: absent,
                  total: count,
                  color: "#d97706",
                }}
              />
            )
          })}
        <StatCard
          label={t("overview.relationships")}
          value={model?.relationship_count ?? 0}
          sub={{
            label: "en erreur",
            value: conflictingRels.length,
            total: model?.relationship_count ?? 0,
            color: "#dc2626",
          }}
        />
        <StatCard
          label={t("overview.views")}
          value={model?.view_count ?? 0}
          sub={{
            label: "",
            value: 0,
            total: model?.view_count || 1,
            color: "#10b981",
          }}
        />
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 gap-6">
        {elements.length > 0 && <TypePieChart elements={elements} />}
        {relationships.length > 0 && (
          <RelPieChart relationships={relationships} />
        )}
      </div>
    </div>
  )
}
