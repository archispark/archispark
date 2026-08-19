import { useMemo } from "react"
import Link from "next/link"
import { type DataTableColumnDef } from "@/components/data-table"
import { type ElementOut, type RelationshipOut } from "@/lib/api"
import { getLayer, LAYER_BADGE_COLORS } from "@/lib/archimate-helpers"
import { allowedRelationships } from "@/lib/archimate-rules"
import { Badge } from "@workspace/ui/components/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useT } from "@/lib/i18n"

const LAYER_COLORS = LAYER_BADGE_COLORS

export function useElementColumns({
  relStats,
}: {
  relStats: Map<string, { ok: number; conflict: number }>
}): DataTableColumnDef<ElementOut>[] {
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
        header: "Statut",
        enableSorting: true,
        accessorFn: (row) => relStats.get(row.identifier)?.conflict ?? 0,
        cell: ({ row }) => {
          const stats = relStats.get(row.original.identifier) ?? {
            ok: 0,
            conflict: 0,
          }
          if (stats.conflict > 0) {
            return (
              <span
                className="inline-flex size-5 items-center justify-center rounded-full bg-destructive/15 text-[11px] text-destructive"
                title={t("common.conflicts")}
              >
                ✕
              </span>
            )
          }
          return (
            <span
              className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-700"
              title={t("common.ok")}
            >
              ✓
            </span>
          )
        },
      },
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/elements/${encodeURIComponent(row.original.identifier)}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.getValue("name") || "—"}
          </Link>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-xs">
            {row.getValue("type")}
          </Badge>
        ),
      },
      {
        id: "layer",
        header: "Layer",
        accessorFn: (row) => getLayer(row.type),
        cell: ({ getValue }) => {
          const layer = getValue<string>()
          return (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_COLORS[layer] ?? ""}`}
            >
              {layer}
            </span>
          )
        },
      },
    ],
    [relStats, t]
  )
}

export function ElementSubRow({
  element,
  allRelationships,
  byId,
}: {
  element: ElementOut
  allRelationships: RelationshipOut[]
  byId: Map<string, ElementOut>
}) {
  const rels = allRelationships.filter(
    (r) => r.source === element.identifier || r.target === element.identifier
  )
  const conflictCount = rels.filter((r) => {
    const src = byId.get(r.source)
    const tgt = byId.get(r.target)
    return !allowedRelationships(src?.type, tgt?.type).includes(r.type)
  }).length
  const okCount = rels.length - conflictCount
  return (
    <div className="flex items-center gap-3 py-0.5 text-[12px]">
      <span className="font-medium text-muted-foreground">Relations :</span>
      <span className="flex items-center gap-1">
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-700">
          ✓
        </span>
        <span className="font-medium text-emerald-700">
          {okCount} valide{okCount !== 1 ? "s" : ""}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-destructive/15 text-[10px] text-destructive">
          ✕
        </span>
        <span
          className={
            conflictCount > 0
              ? "font-medium text-destructive"
              : "text-muted-foreground"
          }
        >
          {conflictCount} conflit{conflictCount !== 1 ? "s" : ""}
        </span>
      </span>
    </div>
  )
}
