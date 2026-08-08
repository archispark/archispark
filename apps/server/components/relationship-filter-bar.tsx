"use client"

import { useT } from "@/lib/i18n"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"

export type RelationshipStatusFilter = "all" | "ok" | "conflict"

export function RelationshipsFilterBar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  types,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  typeFilter: string | null
  onTypeFilterChange: (v: string | null) => void
  types: string[]
  statusFilter: RelationshipStatusFilter
  onStatusFilterChange: (f: RelationshipStatusFilter) => void
}) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-3">
      <Input
        placeholder={t("common.search_by_name")}
        className="min-w-0 flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select
        value={typeFilter ?? ""}
        onValueChange={(val) => onTypeFilterChange(val || null)}
      >
        <SelectTrigger className="min-w-[180px]">
          <SelectValue placeholder={t("common.all_types")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t("common.all_types")}</SelectItem>
          {types.map((rtype) => (
            <SelectItem key={rtype} value={rtype}>
              {rtype}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        {(["all", "ok", "conflict"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onStatusFilterChange(f)}
            className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${statusFilter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}
          >
            {f === "all"
              ? t("common.all")
              : f === "ok"
                ? t("common.ok")
                : t("common.conflicts")}
          </button>
        ))}
      </div>
    </div>
  )
}
