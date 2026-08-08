"use client"

import { useMemo } from "react"
import { type RelationshipOut, type ElementOut } from "@/lib/api"
import { allowedRelationships } from "@/lib/archimate-rules"
import { DataTable } from "@/components/data-table"
import { Button } from "@workspace/ui/components/button"
import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { useElementRelationColumns } from "@/components/use-element-relation-columns"

export function ElementRelationsTab({
  elementId,
  isAdmin,
  relationships,
  relLoading,
  byId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: {
  elementId: string
  isAdmin: boolean
  relationships: RelationshipOut[]
  relLoading: boolean
  byId: Map<string, ElementOut>
  onCreateClick: () => void
  onEditClick: (rel: RelationshipOut) => void
  onDeleteClick: (rel: RelationshipOut) => void
}) {
  const { t } = useT()

  const relCounts = useMemo(() => {
    let ok = 0,
      bad = 0
    for (const rel of relationships) {
      const src = byId.get(rel.source)
      const tgt = byId.get(rel.target)
      if (allowedRelationships(src?.type, tgt?.type).includes(rel.type)) ok++
      else bad++
    }
    return { ok, bad }
  }, [relationships, byId])

  const relColumns = useElementRelationColumns({
    elementId,
    isAdmin,
    byId,
    onEditClick,
    onDeleteClick,
  })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-4">
      <div className="space-y-3">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onCreateClick}>
              <Plus className="mr-1 size-3.5" />
              {t("common.create")}
            </Button>
          </div>
        )}
        <DataTable<RelationshipOut, unknown>
          columns={relColumns}
          data={relationships}
          loading={relLoading}
          pageSize={25}
          searchable
          footerStats={
            <>
              <span className="text-emerald-600">{relCounts.ok} OK</span>
              {" · "}
              <span className={relCounts.bad > 0 ? "text-destructive" : ""}>
                {relCounts.bad} {t("common.conflicts").toLowerCase()}
              </span>
            </>
          }
          renderSubRow={(row) => {
            const rel = row.original as RelationshipOut
            const src = byId.get(rel.source)
            const tgt = byId.get(rel.target)
            const allowed = allowedRelationships(src?.type, tgt?.type)
            const ok = allowed.includes(rel.type)
            return (
              <div className="space-y-0.5 text-[12px] text-muted-foreground">
                {ok ? (
                  <p>
                    <span className="font-medium text-emerald-700">
                      {t("relationships.allowed")}
                    </span>
                    {" — "}
                    {rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}
                  </p>
                ) : (
                  <>
                    <p>
                      <span className="font-medium text-destructive">
                        {t("relationships.not_allowed")}
                      </span>
                      {" — "}
                      {rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}
                    </p>
                    <p>
                      {t("relationships.suggestions")} :{" "}
                      {allowed.length > 0
                        ? allowed.join(", ")
                        : t("common.none")}
                    </p>
                  </>
                )}
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}
