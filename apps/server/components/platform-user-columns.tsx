import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import type { PlatformUserOut } from "@/lib/api"
import { useT } from "@/lib/i18n"

export function usePlatformUserColumns(): ColumnDef<PlatformUserOut>[] {
  const { t } = useT()

  return useMemo(
    () => [
      {
        accessorKey: "username",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/platform/users/${encodeURIComponent(row.original.id)}`}
            className="font-medium text-foreground no-underline hover:underline"
          >
            {row.original.display_name || row.original.username}
          </Link>
        ),
      },
      {
        accessorKey: "email",
        header: t("common.email"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
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
