"use client"

import Link from "next/link"
import { Pencil, Plus } from "lucide-react"
import { useDashboardsForAdministration } from "@/lib/queries/dashboards"
import { useCanEditDashboards } from "@/hooks/use-can-edit-dashboards"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { DeleteDashboardButton } from "@/components/dashboards/admin-dashboard-actions"

export default function DashboardsAdminPage() {
  const { t } = useT()
  const { data: entries = [], isLoading, error } = useDashboardsForAdministration()
  const canEdit = useCanEditDashboards()

  if (!canEdit) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">{t("dashboards.admin_forbidden")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("dashboards.admin_title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("dashboards.admin_subtitle")}</p>
        </div>
        <Button render={<Link href="/dashboards/admin/new" />} nativeButton={false} size="sm">
          <Plus /> {t("dashboards.create_btn")}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <div className="flex flex-col gap-2">
        {entries.map(({ revision, isProvisioned, deletedAt }) => (
          <div
            key={revision.dashboardId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-card-foreground">{revision.definition.title}</span>
                <Badge variant="outline">{revision.dashboardId}</Badge>
                <Badge variant="outline">{t("dashboards.revision_badge", { n: revision.revision })}</Badge>
                {isProvisioned && <Badge variant="secondary">{t("dashboards.provisioned_badge")}</Badge>}
                {deletedAt && <Badge variant="destructive">{t("dashboards.deleted_badge")}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{revision.definition.description}</p>
            </div>
            {!deletedAt && (
              <div className="flex items-center gap-2">
                <Button render={<Link href={`/dashboards/admin/${revision.dashboardId}/edit`} />} nativeButton={false} variant="outline" size="sm">
                  <Pencil /> {t("common.edit")}
                </Button>
                <DeleteDashboardButton dashboardId={revision.dashboardId} />
              </div>
            )}
          </div>
        ))}
        {!isLoading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("dashboards.admin_empty")}</p>
        )}
      </div>
    </div>
  )
}
