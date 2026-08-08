"use client"

import { useParams } from "next/navigation"
import { useDashboard } from "@/lib/queries/dashboards"
import { useCanEditDashboards } from "@/hooks/use-can-edit-dashboards"
import { useT } from "@/lib/i18n"
import { DashboardForm } from "@/components/dashboards/dashboard-form"

export default function EditDashboardPage() {
  const { t } = useT()
  const params = useParams<{ dashboardId: string }>()!
  const dashboardId = decodeURIComponent(params.dashboardId)
  const { data: existing, isLoading, error } = useDashboard(dashboardId)
  const canEdit = useCanEditDashboards()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {existing && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboards.edit_title", { title: existing.definition.title })}</h1>
            <p className="mt-1 text-muted-foreground">{t("dashboards.edit_subtitle", { n: existing.revision + 1 })}</p>
          </div>
          {canEdit ? (
            <DashboardForm mode="edit" dashboardId={dashboardId} initialDefinition={existing.definition} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("dashboards.edit_forbidden")}</p>
          )}
        </>
      )}
    </div>
  )
}
