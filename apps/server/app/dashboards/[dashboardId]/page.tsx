"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useDashboard } from "@/lib/queries/dashboards"
import { useCanEditDashboards } from "@/hooks/use-can-edit-dashboards"
import { useT } from "@/lib/i18n"
import { DashboardRenderer } from "@/components/dashboards/dashboard-renderer"

export default function DashboardPage() {
  const { t } = useT()
  const params = useParams<{ dashboardId: string }>()!
  const dashboardId = decodeURIComponent(params.dashboardId)
  const searchParams = useSearchParams()
  const initialParameters = Object.fromEntries(searchParams?.entries() ?? [])
  const { data: dashboard, isLoading, error } = useDashboard(dashboardId)
  const canEdit = useCanEditDashboards()

  return (
    <div className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {dashboard && (
        <DashboardRenderer
          dashboardId={dashboardId}
          dashboard={dashboard.definition}
          initialParameters={initialParameters}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
