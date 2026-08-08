"use client"

import { usePanelVisualizations } from "@/lib/queries/dashboards"
import { useT } from "@/lib/i18n"
import { Badge } from "@workspace/ui/components/badge"

export default function PanelVisualizationsPage() {
  const { t } = useT()
  const { data, isLoading, error } = usePanelVisualizations()
  const visualizations = data?.visualizations ?? []

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("sidebar.panel_catalog")}</h1>
        <p className="mt-1 text-muted-foreground">{t("panels.catalog_subtitle")}</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visualizations.map((visualization) => (
          <div key={visualization.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-card-foreground">{visualization.name}</h2>
              <Badge variant="outline">{visualization.id}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{visualization.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("panels.catalog_compatible", { types: visualization.acceptedResultTypes.join(", ") })}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
