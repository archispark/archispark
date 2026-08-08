"use client"

import Link from "next/link"
import { type ElementOut } from "@/lib/api"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { useT } from "@/lib/i18n"

/** Double-click-to-edit element reference (source/target) field, shared by both slots on the relationship detail page. */
export function ElementRefField({
  currentId,
  currentName,
  el,
  editing,
  onEditingChange,
  onSave,
  allElements,
  isAdmin,
}: {
  currentId: string
  currentName: string | null
  el: ElementOut | undefined
  editing: boolean
  onEditingChange: (v: boolean) => void
  onSave: (id: string) => Promise<void>
  allElements: ElementOut[]
  isAdmin: boolean
}) {
  const { t } = useT()

  if (isAdmin && editing) {
    return (
      <div className="flex items-center gap-2">
        <Select
          value={currentId}
          onValueChange={async (v) => {
            if (v) await onSave(v)
          }}
          onOpenChange={(open) => {
            if (!open) onEditingChange(false)
          }}
        >
          <SelectTrigger className="h-7 w-full max-w-xs text-xs">
            <span className="truncate">
              {el?.name || currentName || currentId}
            </span>
          </SelectTrigger>
          <SelectContent>
            {allElements.map((e) => (
              <SelectItem key={e.identifier} value={e.identifier}>
                {e.name || e.identifier}
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  {e.type}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditingChange(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${isAdmin ? "group cursor-pointer" : ""}`}
      onDoubleClick={() => isAdmin && onEditingChange(true)}
      title={isAdmin ? "Double-cliquer pour modifier" : undefined}
    >
      {el ? (
        <Link
          href={`/elements/${encodeURIComponent(currentId)}`}
          className="truncate font-medium text-primary hover:underline"
        >
          {el.name || currentId}
        </Link>
      ) : (
        <span className="truncate text-muted-foreground/60">
          {currentName || currentId}
        </span>
      )}
      {el && (
        <span className="shrink-0 text-xs text-muted-foreground">
          ({el.type})
        </span>
      )}
      {isAdmin && (
        <span className="ml-1 text-[10px] opacity-0 group-hover:opacity-40">
          ✎
        </span>
      )}
    </div>
  )
}
