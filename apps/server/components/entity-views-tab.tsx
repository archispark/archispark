"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { type ViewOut } from "@/lib/api"
import { DataTable } from "@/components/data-table"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useT } from "@/lib/i18n"

export function EntityViewsTab({ relViews }: { relViews: ViewOut[] }) {
  const { t } = useT()

  const viewColumns: ColumnDef<ViewOut>[] = useMemo(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => row.toggleExpanded()}
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
        header: t("relationships.status"),
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
        header: t("views.viewpoint"),
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
    ],
    [t]
  )

  if (relViews.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-4">
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("relationships.not_in_views_hint")}
        </p>
      </div>
    )
  }

  const viewCounts = (() => {
    let ok = 0,
      bad = 0
    for (const v of relViews) {
      if (v.conflict_count > 0) bad++
      else ok++
    }
    return { ok, bad }
  })()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-4">
      <DataTable<ViewOut, unknown>
        columns={viewColumns}
        data={relViews}
        pageSize={10}
        searchable
        searchPlaceholder={t("views.search")}
        initialSorting={[{ id: "status", desc: true }]}
        getRowId={(row) => row.identifier}
        footerStats={
          <>
            <span className="text-emerald-600">
              {viewCounts.ok} {t("common.ok")}
            </span>
            {viewCounts.bad > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-destructive">
                  {viewCounts.bad} {t("common.conflicts").toLowerCase()}
                </span>
              </>
            )}
          </>
        }
        renderSubRow={(row) => {
          const { ok_count, conflict_count } = row.original
          return (
            <div className="flex items-center gap-2 py-0.5 text-[12px] text-muted-foreground">
              <span className="font-medium">Relations :</span>
              <span className="flex items-center gap-1">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-700">
                  ✓
                </span>
                <span className="font-medium text-emerald-700">
                  {ok_count} valide{ok_count !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-destructive/15 text-[10px] text-destructive">
                  ✕
                </span>
                <span
                  className={
                    conflict_count > 0 ? "font-medium text-destructive" : ""
                  }
                >
                  {conflict_count} conflit{conflict_count !== 1 ? "s" : ""}
                </span>
              </span>
            </div>
          )
        }}
      />
    </div>
  )
}
