import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { type ViewOut } from "@/lib/api"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"

export function useViewColumns({
  isAdmin,
  onDeleteClick,
}: {
  isAdmin: boolean
  onDeleteClick: (view: ViewOut) => void
}): ColumnDef<ViewOut>[] {
  const { t } = useT()

  return useMemo(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              row.toggleExpanded()
            }}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={
              row.getIsExpanded() ? t("common.collapse") : t("common.expand")
            }
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ),
      },
      {
        id: "status",
        header: "Statut",
        enableSorting: true,
        accessorFn: (row) => row.conflict_count,
        cell: ({ row }) => {
          const { connection_count, ok_count, conflict_count } = row.original
          if (connection_count === 0) {
            return <span className="text-[13px] text-muted-foreground">—</span>
          }
          if (conflict_count === 0) {
            return (
              <span
                className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-700"
                title={`${ok_count} relations valides`}
              >
                ✓
              </span>
            )
          }
          return (
            <span
              className="inline-flex size-5 items-center justify-center rounded-full bg-destructive/15 text-[11px] text-destructive"
              title={`${conflict_count} conflit(s)`}
            >
              ✕
            </span>
          )
        },
      },
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/views/${encodeURIComponent(row.original.identifier)}`}
            className="font-medium text-foreground no-underline hover:text-primary"
          >
            {row.original.name || t("views.unnamed")}
          </Link>
        ),
      },
      {
        accessorKey: "viewpoint",
        header: "Viewpoint",
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">
            {row.original.viewpoint || "—"}
          </span>
        ),
      },
      {
        accessorKey: "node_count",
        header: t("views.nodes"),
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">
            {row.original.node_count}
          </span>
        ),
      },
      {
        accessorKey: "connection_count",
        header: t("views.connections"),
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">
            {row.original.connection_count}
          </span>
        ),
      },
      ...(isAdmin
        ? [
            {
              id: "actions",
              header: "",
              enableSorting: false,
              cell: ({ row }: { row: { original: ViewOut } }) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDeleteClick(row.original)
                  }}
                  className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              ),
            } as ColumnDef<ViewOut>,
          ]
        : []),
    ],
    [isAdmin, t]
  )
}
