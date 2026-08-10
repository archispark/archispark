"use client"

import { useT } from "@/lib/i18n"
import { Search } from "lucide-react"
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
  const statusOptions: {
    label: string
    value: RelationshipStatusFilter
  }[] = [
    { value: "all", label: t("relationships.all_statuses") },
    { value: "ok", label: t("common.ok") },
    { value: "conflict", label: t("common.conflicts") },
  ]
  const statusLabel = statusOptions.find(
    (option) => option.value === statusFilter
  )!.label

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("common.search_by_name")}
          className="pl-8"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
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
      <Select
        value={statusLabel}
        onValueChange={(label) =>
          onStatusFilterChange(
            statusOptions.find((option) => option.label === label)?.value ??
              "all"
          )
        }
      >
        <SelectTrigger className="min-w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
