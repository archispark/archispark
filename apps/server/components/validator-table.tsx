"use client"

import { useMemo, useState } from "react"
import { type DataTableColumnDef } from "@/components/data-table"
import { ChevronRight, ChevronDown } from "lucide-react"
import { allowedRelationships } from "@/lib/archimate-rules"
import type { ElementOut, RelationshipOut } from "@/lib/api"
import { DataTable } from "@/components/data-table"
import { useT } from "@/lib/i18n"

type Filter = "all" | "ok" | "conflict"

interface Row {
  id: string
  type: string
  sourceName: string
  sourceType: string
  targetName: string
  targetType: string
  ok: boolean
  allowed: string[]
}

export function ValidatorTable({
  elements,
  relationships,
}: {
  elements: ElementOut[]
  relationships: RelationshipOut[]
}) {
  const { t } = useT()
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const columns: DataTableColumnDef<Row>[] = useMemo(
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
        header: t("validator.status"),
        accessorFn: (r) => (r.ok ? "OK" : t("common.conflicts")),
        cell: ({ row }) =>
          row.original.ok ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-700">
              ✓
            </span>
          ) : (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-destructive/15 text-[11px] text-destructive">
              ✕
            </span>
          ),
      },
      {
        accessorKey: "type",
        header: t("common.type"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.type}</span>
        ),
      },
      {
        id: "source",
        header: t("common.source"),
        accessorFn: (r) => `${r.sourceName} ${r.sourceType}`,
        cell: ({ row }) => (
          <div>
            <div>{row.original.sourceName}</div>
            <div className="text-[11px] text-muted-foreground">
              {row.original.sourceType}
            </div>
          </div>
        ),
      },
      {
        id: "target",
        header: t("common.target"),
        accessorFn: (r) => `${r.targetName} ${r.targetType}`,
        cell: ({ row }) => (
          <div>
            <div>{row.original.targetName}</div>
            <div className="text-[11px] text-muted-foreground">
              {row.original.targetType}
            </div>
          </div>
        ),
      },
    ],
    [t]
  )

  const rows: Row[] = useMemo(() => {
    const byId = new Map(elements.map((e) => [e.identifier, e]))
    return relationships.map((rel) => {
      const src = byId.get(rel.source)
      const tgt = byId.get(rel.target)
      const allowed = allowedRelationships(src?.type, tgt?.type)
      return {
        id: rel.identifier,
        type: rel.type,
        sourceName: src?.name || "(?)",
        sourceType: src?.type || "?",
        targetName: tgt?.name || "(?)",
        targetType: tgt?.type || "?",
        ok: allowed.includes(rel.type),
        allowed,
      }
    })
  }, [elements, relationships])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === "ok" && !r.ok) return false
      if (filter === "conflict" && r.ok) return false
      if (!q) return true
      return (
        r.type.toLowerCase().includes(q) ||
        r.sourceName.toLowerCase().includes(q) ||
        r.targetName.toLowerCase().includes(q) ||
        r.sourceType.toLowerCase().includes(q) ||
        r.targetType.toLowerCase().includes(q)
      )
    })
  }, [rows, filter, query])

  const counts = useMemo(() => {
    let ok = 0,
      bad = 0
    for (const r of rows) r.ok ? ok++ : bad++
    return { ok, bad, total: rows.length }
  }, [rows])

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("validator.search")}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] text-foreground"
        />
        {(["all", "ok", "conflict"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-8 rounded-md border px-2.5 text-[12px] ${
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {f === "all"
              ? t("validator.all")
              : f === "ok"
                ? t("validator.ok")
                : t("validator.conflicts")}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={10}
        footerStats={
          <>
            <span className="text-emerald-600">{counts.ok} OK</span>
            {" · "}
            <span className={counts.bad > 0 ? "text-destructive" : ""}>
              {counts.bad} {t("common.conflicts").toLowerCase()}
            </span>
          </>
        }
        renderSubRow={(row) => {
          const r = row.original as Row
          return (
            <div className="space-y-0.5 text-[12px] text-muted-foreground">
              {r.ok ? (
                <p>
                  <span className="font-medium text-emerald-700">
                    {t("validator.allowed")}
                  </span>{" "}
                  — {r.type} entre {r.sourceType} et {r.targetType}
                </p>
              ) : (
                <>
                  <p>
                    <span className="font-medium text-destructive">
                      {t("validator.not_allowed")}
                    </span>{" "}
                    — {r.type} entre {r.sourceType} et {r.targetType}
                  </p>
                  <p>
                    {t("validator.suggestions")} :{" "}
                    {r.allowed.length > 0
                      ? r.allowed.join(", ")
                      : t("validator.none")}
                  </p>
                </>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}
