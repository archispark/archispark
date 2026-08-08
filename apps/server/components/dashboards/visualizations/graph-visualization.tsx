"use client"

import { useMemo } from "react"
import { GraphView, type GraphViewEdge, type GraphViewNode } from "@/components/dashboards/graph-view"
import type { PanelVisualizationProps } from "@/components/dashboards/panel-registry-types"
import { useT } from "@/lib/i18n"

export default function GraphVisualization({ result, height }: PanelVisualizationProps) {
  const { t } = useT()
  const nodes = useMemo<GraphViewNode[]>(() => {
    if (result.resultType !== "graph") return []
    const nameById = new Map(result.nodes.map((n) => [n.id, n]))
    return result.nodeIds.map((id) => {
      const meta = nameById.get(id)
      return {
        id,
        label: meta?.name ?? id,
        type: meta?.type ?? "",
        emphasized: id === result.emphasizedId,
        rankGroup: result.rankGroups?.[id],
      }
    })
  }, [result])

  const edges = useMemo<GraphViewEdge[]>(() => {
    if (result.resultType !== "graph") return []
    return result.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }))
  }, [result])

  if (result.resultType !== "graph") {
    return <p className="text-sm text-destructive">{t("panels.graph_incompatible_data")}</p>
  }
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("panels.graph_no_elements")}</p>
  }

  return (
    <GraphView
      nodes={nodes}
      edges={edges}
      height={Math.max(260, height * 70)}
      nodeHref={(id) => `/elements/${encodeURIComponent(id)}`}
    />
  )
}
