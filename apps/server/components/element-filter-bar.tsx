"use client"

import { forwardRef } from "react"
import { Search } from "lucide-react"
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
    layerFilter: string | null
    onLayerFilterChange: (v: string | null) => void
    layerOptions: string[]
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
    layerFilter,
    onLayerFilterChange,
    layerOptions,
    statusFilter,
    onStatusFilterChange,
  },
  searchRef
) {
  const { t } = useT()
  const statusOptions: { label: string; value: ElementStatusFilter }[] = [
    { value: "all", label: t("elements.all_statuses") },
    { value: "ok", label: t("common.ok") },
    { value: "conflict", label: t("common.conflicts") },
    { value: "absent", label: "Absents" },
  ]
  const statusLabel = statusOptions.find(
    (option) => option.value === statusFilter
  )!.label

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder={t("common.search_by_name")}
          className="pl-8"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select
        value={layerFilter ?? ""}
        onValueChange={(val) => onLayerFilterChange(val || null)}
      >
        <SelectTrigger className="min-w-[150px]">
          <SelectValue placeholder={t("elements.all_layers")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t("elements.all_layers")}</SelectItem>
          {layerOptions.map((layer) => (
            <SelectItem key={layer} value={layer}>
              {layer}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
})
