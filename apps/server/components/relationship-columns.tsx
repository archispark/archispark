import { useMemo } from "react"
import Link from "next/link"
import { type DataTableColumnDef } from "@/components/data-table"
import { type RelationshipOut, type ElementOut } from "@/lib/api"
import { Badge } from "@workspace/ui/components/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useT } from "@/lib/i18n"
import { allowedRelationships } from "@/lib/archimate-rules"
import { getLayer, LAYER_BADGE_COLORS } from "@/lib/archimate-helpers"

function ElementReference({ label, type }: { label: string; type?: string }) {
  return (
    <div className="flex max-w-[150px] items-center gap-1.5 text-xs whitespace-nowrap">
      <span className="min-w-0 truncate">{label}</span>
      {type && (
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${LAYER_BADGE_COLORS[getLayer(type)] ?? ""}`}
        >
          {type}
        </Badge>
      )}
    </div>
  )
}

export function useRelationshipColumns({
  byId,
  byRelId,
}: {
  byId: Map<string, ElementOut>
  byRelId: Map<string, RelationshipOut>
}): DataTableColumnDef<RelationshipOut>[] {
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
          const src = byId.get(row.original.source)
          const tgt = byId.get(row.original.target)
          const ok = allowedRelationships(src?.type, tgt?.type).includes(
            row.original.type
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
          <Link
            href={`/relationships/${encodeURIComponent(row.original.identifier)}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {(row.getValue("name") as string | null) || (
              <span className="text-muted-foreground italic">
                {row.original.type}
              </span>
            )}
          </Link>
        ),
      },
      {
        accessorKey: "source",
        header: t("common.source"),
        cell: ({ row }) => {
          const rel = row.original
          const el = byId.get(rel.source)
          const refRel = !el ? byRelId.get(rel.source) : undefined
          const label =
            rel.source_name ||
            el?.name ||
            refRel?.name ||
            refRel?.type ||
            rel.source
          const sub =
            el?.type ?? (refRel ? t("relationships.title") : undefined)
          return <ElementReference label={label} type={sub} />
        },
      },
      {
        accessorKey: "target",
        header: t("common.target"),
        cell: ({ row }) => {
          const rel = row.original
          const el = byId.get(rel.target)
          const refRel = !el ? byRelId.get(rel.target) : undefined
          const label =
            rel.target_name ||
            el?.name ||
            refRel?.name ||
            refRel?.type ||
            rel.target
          const sub =
            el?.type ?? (refRel ? t("relationships.title") : undefined)
          return <ElementReference label={label} type={sub} />
        },
      },
    ],
    [byId, byRelId, t]
  )
}

export function RelationshipSubRow({
  rel,
  byId,
}: {
  rel: RelationshipOut
  byId: Map<string, ElementOut>
}) {
  const src = byId.get(rel.source)
  const tgt = byId.get(rel.target)
  const allowed = allowedRelationships(src?.type, tgt?.type)
  const ok = allowed.includes(rel.type)
  return (
    <div className="space-y-0.5 text-[12px] text-muted-foreground">
      {ok ? (
        <p>
          <span className="font-medium text-emerald-700">Autorisé</span> —{" "}
          {rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}
        </p>
      ) : (
        <>
          <p>
            <span className="font-medium text-destructive">Non autorisé</span> —{" "}
            {rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}
          </p>
          <p>
            Suggestions : {allowed.length > 0 ? allowed.join(", ") : "aucune"}
          </p>
        </>
      )}
    </div>
  )
}

export function RelationshipStats({
  ok,
  bad,
  t,
}: {
  ok: number
  bad: number
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <>
      <span className="text-emerald-600">
        {ok} {t("common.ok")}
      </span>
      {bad > 0 && (
        <>
          {" "}
          ·{" "}
          <span className="text-destructive">
            {bad} {t("common.conflicts").toLowerCase()}
          </span>
        </>
      )}
    </>
  )
}
