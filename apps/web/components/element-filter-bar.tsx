"use client"

import { forwardRef } from "react"
import { useT } from "@/lib/i18n"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"

export type ElementStatusFilter = "all" | "ok" | "conflict" | "absent"

export const ElementsFilterBar = forwardRef<
  HTMLInputElement,
  {
    search: string
    onSearchChange: (v: string) => void
    typeFilter: string | null
    onTypeFilterChange: (v: string | null) => void
    typeOptions: string[]
    statusFilter: ElementStatusFilter
    onStatusFilterChange: (f: ElementStatusFilter) => void
  }
>(function ElementsFilterBar(
  {
    search,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    typeOptions,
    statusFilter,
    onStatusFilterChange,
  },
  searchRef
) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-3">
      <Input
        ref={searchRef}
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
          <SelectValue placeholder="Tous les types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t("common.all_types")}</SelectItem>
          {typeOptions.map((typ) => (
            <SelectItem key={typ} value={typ}>
              {typ}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        {(["all", "ok", "conflict", "absent"] as const).map((f) => (
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
                : f === "conflict"
                  ? t("common.conflicts")
                  : "Absents"}
          </button>
        ))}
      </div>
    </div>
  )
})
