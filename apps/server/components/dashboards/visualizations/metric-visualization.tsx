"use client"

import type { PanelVisualizationProps } from "@/components/dashboards/panel-registry-types"
import { useT } from "@/lib/i18n"

export default function MetricVisualization({ result, definition }: PanelVisualizationProps) {
  const { t } = useT()
  if (result.resultType !== "metrics") {
    return <p className="text-sm text-destructive">{t("panels.metric_incompatible_data")}</p>
  }
  const max = definition.visualization.max
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <p className="text-3xl font-semibold text-card-foreground">
        {result.count}
        {max !== undefined && <span className="text-base font-normal text-muted-foreground"> / {max}</span>}
      </p>
      <p className="text-sm text-muted-foreground">{definition.title}</p>
    </div>
  )
}
