"use client"

import { PanelTable } from "@/components/dashboards/panel-table"
import type { PanelVisualizationProps } from "@/components/dashboards/panel-registry-types"
import { useT } from "@/lib/i18n"

export default function TableVisualization({ result, definition }: PanelVisualizationProps) {
  const { t } = useT()
  if (result.resultType !== "table") {
    return <p className="text-sm text-destructive">{t("panels.table_incompatible_data")}</p>
  }
  return (
    <PanelTable
      rows={result.rows}
      columnOrder={definition.visualization.columnOrder}
      columns={definition.visualization.columns}
      freezeFirstColumn={definition.visualization.freezeFirstColumn}
      initialPageSize={definition.visualization.pageSize}
    />
  )
}
