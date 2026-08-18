import { useMemo } from "react"
import Link from "next/link"
import { type DataTableColumnDef } from "@/components/data-table"
import type { PlatformOrganizationOut } from "@/lib/api"
import { useT } from "@/lib/i18n"

export function usePlatformOrganizationColumns(): DataTableColumnDef<PlatformOrganizationOut>[] {
  const { t } = useT()

  return useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/platform/organizations/${encodeURIComponent(row.original.id)}`}
            className="flex items-center gap-2 font-medium text-foreground no-underline hover:underline"
          >
            {row.original.name}
            {row.original.is_personal && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                {t("organizations.personal_badge")}
              </span>
            )}
          </Link>
        ),
      },
      {
        accessorKey: "slug",
        header: t("common.identifier"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.slug}
          </span>
        ),
      },
      {
        accessorKey: "enabled",
        header: t("common.status"),
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={`text-[11px] font-medium ${row.original.enabled ? "text-primary" : "text-destructive"}`}
          >
            {row.original.enabled
              ? t("platform.status_enabled")
              : t("platform.status_suspended")}
          </span>
        ),
      },
    ],
    [t]
  )
}
