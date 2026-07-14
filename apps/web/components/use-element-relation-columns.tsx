import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { type RelationshipOut, type ElementOut } from "@/lib/api"
import { allowedRelationships } from "@/lib/archimate-rules"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ChevronDown, ChevronRight, Trash2, Pencil } from "lucide-react"
import { useT } from "@/lib/i18n"

/** Relation-table column definitions for the element detail page's relations tab. */
export function useElementRelationColumns({
  elementId,
  isAdmin,
  byId,
  onEditClick,
  onDeleteClick,
}: {
  elementId: string
  isAdmin: boolean
  byId: Map<string, ElementOut>
  onEditClick: (rel: RelationshipOut) => void
  onDeleteClick: (rel: RelationshipOut) => void
}): ColumnDef<RelationshipOut>[] {
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
        accessorFn: (rel) => {
          const src = byId.get(rel.source)
          const tgt = byId.get(rel.target)
          return allowedRelationships(src?.type, tgt?.type).includes(rel.type)
            ? "OK"
            : "Conflit"
        },
        cell: ({ row }) => {
          const rel = row.original
          const src = byId.get(rel.source)
          const tgt = byId.get(rel.target)
          const ok = allowedRelationships(src?.type, tgt?.type).includes(
            rel.type
          )
          return ok ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-700">
              ✓
            </span>
          ) : (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-destructive/15 text-[11px] text-destructive">
              ✕
            </span>
          )
        },
      },
      {
        accessorKey: "type",
        header: t("common.type"),
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-xs">
            {row.getValue("type")}
          </Badge>
        ),
      },
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <span className="font-medium">
            {(row.getValue("name") as string | null) || "—"}
          </span>
        ),
      },
      {
        id: "source",
        header: t("common.source"),
        accessorFn: (r) => r.source_name || r.source,
        cell: ({ row }) => {
          const rel = row.original
          const el = byId.get(rel.source)
          const label = rel.source_name || el?.name || rel.source
          const isThis = rel.source === elementId
          return (
            <div className="max-w-[130px] text-xs">
              {isThis ? (
                <div className="truncate font-semibold">{label}</div>
              ) : (
                <Link
                  href={`/elements/${encodeURIComponent(rel.source)}`}
                  className="block truncate text-muted-foreground hover:underline"
                >
                  {label}
                </Link>
              )}
              {el?.type && (
                <div className="text-muted-foreground">{el.type}</div>
              )}
            </div>
          )
        },
      },
      {
        id: "target",
        header: t("common.target"),
        accessorFn: (r) => r.target_name || r.target,
        cell: ({ row }) => {
          const rel = row.original
          const el = byId.get(rel.target)
          const label = rel.target_name || el?.name || rel.target
          const isThis = rel.target === elementId
          return (
            <div className="max-w-[130px] text-xs">
              {isThis ? (
                <div className="truncate font-semibold">{label}</div>
              ) : (
                <Link
                  href={`/elements/${encodeURIComponent(rel.target)}`}
                  className="block truncate text-muted-foreground hover:underline"
                >
                  {label}
                </Link>
              )}
              {el?.type && (
                <div className="text-muted-foreground">{el.type}</div>
              )}
            </div>
          )
        },
      },
      ...(isAdmin
        ? [
            {
              id: "rel_actions",
              header: "",
              enableSorting: false,
              cell: ({ row }: { row: { original: RelationshipOut } }) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onEditClick(row.original)}
                    aria-label={t("common.edit")}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDeleteClick(row.original)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [isAdmin, byId, elementId, onEditClick, onDeleteClick, t]
  )
}
