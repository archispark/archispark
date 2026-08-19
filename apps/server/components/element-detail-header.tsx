"use client"

import { type ElementUpdateIn, type ElementOut } from "@/lib/api"
import { InlineText } from "@/components/detail-page-shared"
import { ArchimateTypeBadge } from "@/components/archimate-type-badge"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"

// ── Element picker select ─────────────────────────────────────────────────────

export function ElementSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: ElementOut[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((el) => (
          <SelectItem key={el.identifier} value={el.identifier}>
            {el.name || el.identifier}
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              {el.type}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── Element header (badges, name and description) ────────────────────────────

export function ElementHeader({
  element,
  isAdmin,
  saveField,
  layer,
  layerColor,
  onDelete,
}: {
  element: ElementOut
  isAdmin: boolean
  saveField: (patch: ElementUpdateIn) => Promise<void>
  layer: string
  layerColor: string
  onDelete: () => void
}) {
  const { t } = useT()
  return (
    <div className="shrink-0 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Name */}
          <div className="flex items-center gap-2">
            {element.resolved_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={element.resolved_image_url}
                alt=""
                className="size-8 shrink-0 rounded"
              />
            ) : (
              <ArchimateTypeBadge elementType={element.type} size={32} />
            )}
            <InlineText
              value={element.name}
              onSave={(v) => saveField({ name: v })}
              className="block min-w-0 flex-1 text-xl leading-tight font-semibold sm:text-2xl"
              placeholder={t("elements.placeholder")}
              disabled={!isAdmin}
            />
          </div>
        </div>

        {/* Delete button */}
        {isAdmin && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="shrink-0"
          >
            <Trash2 className="mr-1.5 size-3.5" />
            {t("common.delete")}
          </Button>
        )}
      </div>

      {/* Description */}
      <InlineText
        value={element.documentation ?? ""}
        onSave={(v) => saveField({ documentation: v || null })}
        className="block w-full text-sm leading-relaxed text-muted-foreground"
        placeholder={t("elements.no_documentation")}
        multiline
        disabled={!isAdmin}
      />

      {/* Badges: type + layer */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono text-xs">
          {element.type}
        </Badge>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${layerColor}`}
        >
          {layer}
        </span>
      </div>
    </div>
  )
}
