"use client"

import dynamic from "next/dynamic"
import type { ComponentType } from "react"
import { normalizePanelVisualizationId } from "@/lib/dashboards/contracts"
import { NATIVE_PANEL_VISUALIZATIONS } from "@/lib/dashboards/native-visualizations"
import { useT } from "@/lib/i18n"
import type { PanelVisualizationProps } from "./panel-registry-types"

function Loading() {
  const { t } = useT()
  return <p className="text-sm text-muted-foreground">{t("panels.loading_visualization")}</p>
}

// `@xyflow/react` (graph) est chargé à la demande — un dashboard composé
// uniquement de panneaux tableau/métrique ne le télécharge jamais.
const components: Record<string, ComponentType<PanelVisualizationProps>> = {
  "core/graph": dynamic(() => import("./visualizations/graph-visualization"), { loading: Loading }),
  "core/table": dynamic(() => import("./visualizations/table-visualization"), { loading: Loading }),
  "core/metric": dynamic(() => import("./visualizations/metric-visualization"), { loading: Loading }),
}

export function getPanelVisualizationComponent(type: string): ComponentType<PanelVisualizationProps> | undefined {
  return components[normalizePanelVisualizationId(type)]
}

export { NATIVE_PANEL_VISUALIZATIONS }
