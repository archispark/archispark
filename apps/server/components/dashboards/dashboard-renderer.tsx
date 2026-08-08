"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Pencil } from "lucide-react"
import type { DashboardDefinition, PanelContent } from "@/lib/dashboards/contracts"
import { getPanelVisualizationComponent } from "@/components/dashboards/panel-registry"
import { PanelVisualizationBoundary } from "@/components/dashboards/panel-visualization-boundary"
import { PanelFrame } from "@/components/dashboards/panel-frame"
import { usePanelResult } from "@/lib/queries/dashboards"
import { useElements } from "@/lib/queries/elements"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { DeleteDashboardButton } from "@/components/dashboards/admin-dashboard-actions"

function DashboardPanel({
  dashboardId,
  panelInstanceId,
  definition,
  values,
  height,
}: {
  dashboardId: string
  panelInstanceId: string
  definition: PanelContent
  values: Record<string, string>
  height: number
}) {
  const { t } = useT()
  const hasMissingRequiredParameter = definition.parameters.some(
    (parameter) => parameter.required && !values[parameter.name]?.trim()
  )
  const { data: result, error } = usePanelResult(
    dashboardId,
    panelInstanceId,
    values,
    !hasMissingRequiredParameter
  )

  const Visualization = useMemo(
    () => getPanelVisualizationComponent(definition.visualization.type),
    [definition.visualization.type]
  )

  return (
    <PanelFrame
      title={definition.title}
      description={definition.description}
      error={error ? (error as Error).message : undefined}
      loading={!hasMissingRequiredParameter && !result && !error}
    >
      {hasMissingRequiredParameter && (
        <p className="text-sm text-muted-foreground">Renseignez les paramètres requis pour afficher ce panneau.</p>
      )}
      {result && !Visualization && (
        <p className="text-sm text-destructive">
          {t("dashboards.unknown_visualization", { type: definition.visualization.type })}
        </p>
      )}
      {result && Visualization && (
        <PanelVisualizationBoundary>
          <Visualization result={result} definition={definition} height={height} />
        </PanelVisualizationBoundary>
      )}
    </PanelFrame>
  )
}

export function DashboardRenderer({
  dashboardId,
  dashboard,
  initialParameters,
  canEdit,
}: {
  dashboardId: string
  dashboard: DashboardDefinition
  initialParameters: Record<string, string>
  canEdit: boolean
}) {
  const { t } = useT()
  const { data: elements = [] } = useElements()
  const [parameters, setParameters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      dashboard.parameters.map((parameter) => [
        parameter.name,
        initialParameters[parameter.name] ?? (parameter.defaultValue === undefined ? "" : String(parameter.defaultValue)),
      ])
    )
  )
  const instancesById = new Map(dashboard.panels.map((instance) => [instance.id, instance]))
  const tabbedPanelIds = new Set(dashboard.tabGroups?.flatMap((group) => group.tabs.flatMap((tab) => tab.panelIds)) ?? [])

  const renderPanel = (instance: DashboardDefinition["panels"][number]) => {
    const values = Object.fromEntries(
      Object.entries(instance.parameterBindings).map(([name, binding]) => [
        name,
        binding.source === "constant" ? String(binding.value) : (parameters[binding.parameter] ?? ""),
      ])
    )
    return (
      <div key={instance.id} className="min-w-0" style={{ gridColumn: `span ${instance.layout.width} / span ${instance.layout.width}` }}>
        <DashboardPanel
          dashboardId={dashboardId}
          panelInstanceId={instance.id}
          definition={instance.panel}
          values={values}
          height={instance.layout.height}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{dashboard.title}</h1>
          <p className="mt-1 text-muted-foreground">{dashboard.description}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button render={<Link href={`/dashboards/admin/${dashboardId}/edit`} />} nativeButton={false} variant="outline" size="sm">
              <Pencil /> {t("common.edit")}
            </Button>
            <DeleteDashboardButton dashboardId={dashboardId} />
          </div>
        )}
      </div>
      {dashboard.parameters.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-muted/40 p-3">
          {dashboard.parameters.map((parameter) => (
            <label key={parameter.name} className="flex min-w-56 flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">{parameter.label}</span>
              {parameter.selector ? (
                <select
                  value={parameters[parameter.name]}
                  onChange={(event) => setParameters((current) => ({ ...current, [parameter.name]: event.target.value }))}
                  className="rounded-md border border-border bg-background px-3 py-1.5"
                >
                  <option value="">Sélectionnez un élément…</option>
                  {elements
                    .filter((element) => parameter.selector!.elementTypes.includes(element.type))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((element) => (
                      <option key={element.identifier} value={element.identifier}>
                        {element.name} ({element.type})
                      </option>
                    ))}
                </select>
              ) : parameter.allowedValues ? (
                <select
                  value={parameters[parameter.name]}
                  onChange={(event) => setParameters((current) => ({ ...current, [parameter.name]: event.target.value }))}
                  className="rounded-md border border-border bg-background px-3 py-1.5"
                >
                  {parameter.allowedValues.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={parameters[parameter.name]}
                  onChange={(event) => setParameters((current) => ({ ...current, [parameter.name]: event.target.value }))}
                  placeholder={parameter.selector ? t("dashboards.parameter_element_id") : undefined}
                  className="rounded-md border border-border bg-background px-3 py-1.5"
                />
              )}
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {dashboard.panels.filter((instance) => !tabbedPanelIds.has(instance.id)).map(renderPanel)}
      </div>
      {dashboard.tabGroups?.map((group) => (
        <Tabs key={group.id} defaultValue={group.tabs[0]!.id}>
          <TabsList>
            {group.tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {group.tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {tab.panelIds
                  .map((panelId) => instancesById.get(panelId))
                  .filter((instance): instance is DashboardDefinition["panels"][number] => !!instance)
                  .map(renderPanel)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ))}
    </div>
  )
}
