"use client"

import { useCanEditDashboards } from "@/hooks/use-can-edit-dashboards"
import { useT } from "@/lib/i18n"
import { DashboardForm } from "@/components/dashboards/dashboard-form"

export default function NewDashboardPage() {
  const { t } = useT()
  const canEdit = useCanEditDashboards()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("dashboards.new_title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("dashboards.new_subtitle")}</p>
      </div>
      {canEdit ? (
        <DashboardForm mode="create" />
      ) : (
        <p className="text-sm text-muted-foreground">{t("dashboards.create_forbidden")}</p>
      )}
    </div>
  )
}
