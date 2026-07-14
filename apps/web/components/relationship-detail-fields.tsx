"use client"

import {
  type RelationshipOut,
  type RelationshipUpdateIn,
  type ElementOut,
} from "@/lib/api"
import { allowedRelationships } from "@/lib/archimate-rules"
import { InlineText } from "@/components/detail-page-shared"
import { ElementRefField } from "@/components/relationship-element-ref-field"
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

export function RelationshipFields({
  rel,
  isAdmin,
  saveField,
  onDelete,
  editingType,
  setEditingType,
  relTypes,
  isOk,
  editingSource,
  setEditingSource,
  allElements,
  srcEl,
  editingTarget,
  setEditingTarget,
  tgtEl,
}: {
  rel: RelationshipOut
  isAdmin: boolean
  saveField: (patch: RelationshipUpdateIn) => Promise<void>
  onDelete: () => void
  editingType: boolean
  setEditingType: (v: boolean) => void
  relTypes: string[]
  isOk: boolean
  editingSource: boolean
  setEditingSource: (v: boolean) => void
  allElements: ElementOut[]
  srcEl: ElementOut | undefined
  editingTarget: boolean
  setEditingTarget: (v: boolean) => void
  tgtEl: ElementOut | undefined
}) {
  const { t } = useT()
  return (
    <div className="max-h-[55vh] shrink-0 space-y-3 overflow-y-auto pb-1">
      {/* Name + delete */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <InlineText
            value={rel.name ?? ""}
            onSave={(v) => saveField({ name: v || null })}
            className="block w-full text-xl leading-tight font-semibold sm:text-2xl"
            placeholder={t("relationships.placeholder")}
            disabled={!isAdmin}
          />
        </div>
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

      {/* Compact editable fields */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        {/* Type */}
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {t("common.type")}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {isAdmin && editingType ? (
            <div className="flex items-center gap-2">
              <Select
                value={rel.type}
                onValueChange={async (v) => {
                  if (v) await saveField({ type: v })
                }}
                onOpenChange={(open) => {
                  if (!open) setEditingType(false)
                }}
              >
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relTypes.map((rt) => (
                    <SelectItem key={rt} value={rt}>
                      {rt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingType(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <Badge
              variant="secondary"
              className={`font-mono text-xs ${isAdmin ? "cursor-pointer hover:ring-1 hover:ring-ring" : ""}`}
              onDoubleClick={() => isAdmin && setEditingType(true)}
              title={isAdmin ? "Double-cliquer pour modifier" : undefined}
            >
              {rel.type}
            </Badge>
          )}
          {isOk ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700">
              ✓ {t("relationships.allowed")}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
              ✕ {t("relationships.not_allowed")}
            </span>
          )}
        </div>

        {/* Source */}
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {t("common.source")}
        </span>
        <div className="min-w-0">
          <ElementRefField
            currentId={rel.source}
            currentName={rel.source_name}
            el={srcEl}
            editing={editingSource}
            onEditingChange={setEditingSource}
            onSave={(v) => saveField({ source: v })}
            allElements={allElements}
            isAdmin={isAdmin}
          />
        </div>

        {/* Target */}
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {t("common.target")}
        </span>
        <div className="min-w-0">
          <ElementRefField
            currentId={rel.target}
            currentName={rel.target_name}
            el={tgtEl}
            editing={editingTarget}
            onEditingChange={setEditingTarget}
            onSave={(v) => saveField({ target: v })}
            allElements={allElements}
            isAdmin={isAdmin}
          />
        </div>

        {/* Suggestions when invalid */}
        {!isOk && srcEl && tgtEl && (
          <>
            <span />
            <span className="text-xs text-destructive">
              {t("relationships.suggestions")} :{" "}
              {allowedRelationships(srcEl.type, tgtEl.type).join(", ") ||
                t("common.none")}
            </span>
          </>
        )}

        {/* Documentation */}
        <span className="self-start pt-0.5 text-xs whitespace-nowrap text-muted-foreground">
          {t("common.documentation")}
        </span>
        <InlineText
          value={rel.documentation ?? ""}
          onSave={(v) => saveField({ documentation: v || null })}
          className="block w-full text-sm leading-relaxed text-muted-foreground"
          placeholder={t("relationships.no_documentation")}
          multiline
          disabled={!isAdmin}
        />
      </div>
    </div>
  )
}
