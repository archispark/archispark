import { useMemo } from "react"
import Link from "next/link"
import { Ban, Play } from "lucide-react"
import { type DataTableColumnDef } from "@/components/data-table"
import type { PlatformPluginOut } from "@/lib/api"
import { useSetPlatformPluginEnabled } from "@/lib/queries"
import { Button } from "@workspace/ui/components/button"
import { useT } from "@/lib/i18n"

export function usePlatformPluginColumns(): DataTableColumnDef<PlatformPluginOut>[] {
  const { t } = useT()
  const setEnabled = useSetPlatformPluginEnabled()

  return useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/platform/plugins/${encodeURIComponent(row.original.slug)}`}
            className="font-medium text-foreground no-underline hover:underline"
          >
            {row.original.name}
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
        accessorKey: "version",
        header: t("platform.plugins.version"),
        enableSorting: false,
      },
      {
        accessorKey: "icon_count",
        header: t("platform.plugins.icon_count"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.icon_count}</span>
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
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const plugin = row.original
          return (
            <Button
              variant="ghost"
              size="sm"
              disabled={setEnabled.isPending}
              onClick={(e) => {
                e.stopPropagation()
                setEnabled.mutate({
                  slug: plugin.slug,
                  enabled: !plugin.enabled,
                })
              }}
            >
              {plugin.enabled ? (
                <>
                  <Ban className="size-3.5" />
                  {t("platform.plugins.disable_btn")}
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  {t("platform.plugins.enable_btn")}
                </>
              )}
            </Button>
          )
        },
      },
    ],
    [t, setEnabled]
  )
}
