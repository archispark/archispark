"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useDashboards } from "@/lib/queries/dashboards"
import { useCanEditDashboards } from "@/hooks/use-can-edit-dashboards"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"

export default function DashboardsPage() {
  const { t } = useT()
  const { data: dashboards = [], isLoading, error } = useDashboards()
  const canEdit = useCanEditDashboards()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("sidebar.dashboards")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("dashboards.subtitle")}
          </p>
        </div>
        {canEdit && (
          <Button
            render={<Link href="/dashboards/admin/new" />}
            nativeButton={false}
            size="sm"
            className="bg-indigo-600 text-primary-foreground hover:bg-indigo-700"
          >
            <Plus /> {t("common.add")}
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}

      {!isLoading && dashboards.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("dashboards.empty")}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map(({ definition }) => (
          <Link
            key={definition.id}
            href={`/dashboards/${definition.id}`}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <h2 className="font-semibold text-card-foreground">
              {definition.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {definition.description}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("dashboards.panel_count", { n: definition.panels.length })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
