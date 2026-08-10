"use client"

import { useT } from "@/lib/i18n"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export type ViewStatusFilter = "all" | "ok" | "conflict"

export function ViewStatusFilterSelect({
  value,
  onValueChange,
}: {
  value: ViewStatusFilter
  onValueChange: (value: ViewStatusFilter) => void
}) {
  const { t } = useT()
  const options: { label: string; value: ViewStatusFilter }[] = [
    { value: "all", label: t("views.all_statuses") },
    { value: "ok", label: t("common.ok") },
    { value: "conflict", label: t("common.conflicts") },
  ]
  const label = options.find((option) => option.value === value)!.label

  return (
    <Select
      value={label}
      onValueChange={(nextLabel) =>
        onValueChange(
          options.find((option) => option.label === nextLabel)?.value ?? "all"
        )
      }
    >
      <SelectTrigger className="min-w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.label}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
