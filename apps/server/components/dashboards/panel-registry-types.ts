import type { PanelContent, PanelResult } from "@/lib/dashboards/contracts"

/** Split out from panel-registry.tsx to avoid a circular import: the visualization components import this type, and panel-registry.tsx dynamically imports the visualization components. */
export interface PanelVisualizationProps {
  result: PanelResult
  definition: PanelContent
  height: number
}
