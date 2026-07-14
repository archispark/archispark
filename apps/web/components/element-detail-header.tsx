"use client"

import Link from "next/link"
import {
  type RelationshipOut,
  type ElementUpdateIn,
  type ElementOut,
} from "@/lib/api"
import { InlineText } from "@/components/detail-page-shared"
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

// ── Element header (badges, name, description, specialization) ────────────────

export function ElementHeader({
  element,
  isAdmin,
  editingType,
  setEditingType,
  groupedTypes,
  saveField,
  layer,
  layerColor,
  isInViews,
  editingSpec,
  setEditingSpec,
  elementSelectOpts,
  specializes,
  saveSpecialization,
  onDelete,
}: {
  element: ElementOut
  isAdmin: boolean
  editingType: boolean
  setEditingType: (v: boolean) => void
  groupedTypes: Record<string, string[]>
  saveField: (patch: ElementUpdateIn) => Promise<void>
  layer: string
  layerColor: string
  isInViews: boolean
  editingSpec: boolean
  setEditingSpec: (v: boolean) => void
  elementSelectOpts: ElementOut[]
  specializes: RelationshipOut[]
  saveSpecialization: (targetId: string) => Promise<void>
  onDelete: () => void
}) {
  const { t } = useT()
  return (
    <div className="shrink-0 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Badges: type (inline-editable) + layer + status */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && editingType ? (
              <Select
                value={element.type}
                onValueChange={async (v) => {
                  if (v) {
                    await saveField({ type: v })
                  }
                  setEditingType(false)
                }}
              >
                <SelectTrigger className="h-6 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedTypes).map(([groupLayer, types]) =>
                    types.map((typ) => (
                      <SelectItem key={typ} value={typ}>
                        {typ}
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {groupLayer}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="secondary"
                className={`font-mono text-xs ${isAdmin ? "cursor-pointer hover:ring-1 hover:ring-ring" : ""}`}
                onDoubleClick={() => isAdmin && setEditingType(true)}
                title={
                  isAdmin ? "Double-cliquer pour modifier le type" : undefined
                }
              >
                {element.type}
              </Badge>
            )}
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${layerColor}`}
            >
              {layer}
            </span>
            {isInViews ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700">
                ✓ {t("elements.in_views")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                ⚠ {t("elements.not_in_views")}
              </span>
            )}
          </div>

          {/* Name */}
          <InlineText
            value={element.name}
            onSave={(v) => saveField({ name: v })}
            className="block w-full text-xl leading-tight font-semibold sm:text-2xl"
            placeholder={t("elements.placeholder")}
            disabled={!isAdmin}
          />
        </div>

        {/* Delete button */}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
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

      {/* Not-in-views warning */}
      {!isInViews && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50/50 px-3 py-2 text-sm text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400">
          <span className="shrink-0">⚠</span>
          {t("elements.not_in_views_hint")}
        </div>
      )}

      {/* Specialization */}
      <div className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">
          {t("elements.specialization")} :
        </span>
        {isAdmin && editingSpec ? (
          <div className="flex items-center gap-2">
            <div className="w-56">
              <ElementSelect
                options={elementSelectOpts}
                value={specializes[0]?.target ?? ""}
                onChange={saveSpecialization}
                placeholder="— aucune —"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingSpec(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <span
            onDoubleClick={() => isAdmin && setEditingSpec(true)}
            className={`${isAdmin ? "group -mx-1 cursor-text rounded px-1 transition-colors hover:bg-muted/40" : ""}`}
            title={isAdmin ? "Double-cliquer pour modifier" : undefined}
          >
            {specializes.length > 0 ? (
              specializes.map((r) => (
                <Link
                  key={r.identifier}
                  href={`/elements/${encodeURIComponent(r.target)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.target_name || r.target}
                </Link>
              ))
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
            {isAdmin && (
              <span className="ml-1 align-middle text-[10px] opacity-0 group-hover:opacity-40">
                ✎
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
