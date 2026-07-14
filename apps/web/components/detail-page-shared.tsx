"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { useT } from "@/lib/i18n"

/** Simple tab bar shared by the element/relationship detail pages. */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
            active === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">
              ({tab.count})
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** Double-click-to-edit inline text/textarea, shared by the element/relationship detail pages. */
export function InlineText({
  value,
  onSave,
  className = "",
  placeholder = "—",
  multiline = false,
  disabled = false,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])
  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    if (draft.trim() !== value) onSave(draft.trim())
  }
  function cancel() {
    setEditing(false)
    setDraft(value)
  }

  if (!editing) {
    return (
      <span
        onDoubleClick={() => {
          if (!disabled) {
            setDraft(value)
            setEditing(true)
          }
        }}
        className={`${className} ${disabled ? "" : "group relative -mx-1 cursor-text rounded px-1 transition-colors hover:bg-muted/40"}`}
        title={disabled ? undefined : "Double-cliquer pour modifier"}
      >
        {value || (
          <span className="text-muted-foreground/50 italic">{placeholder}</span>
        )}
        {!disabled && (
          <span className="ml-1 align-middle text-[10px] opacity-0 group-hover:opacity-40">
            ✎
          </span>
        )}
      </span>
    )
  }

  const sharedProps = {
    ref,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel()
      if (!multiline && e.key === "Enter") {
        e.preventDefault()
        commit()
      }
    },
    className: `${className} border border-ring rounded px-1 -mx-1 bg-background outline-none w-full`,
  }

  return multiline ? (
    <textarea {...sharedProps} rows={3} style={{ resize: "vertical" }} />
  ) : (
    <input {...sharedProps} />
  )
}

/** Confirm-delete dialog for a single property row, shared by the element/relationship detail pages. */
export function DeletePropertyConfirmDialog({
  propRef,
  onOpenChange,
  onConfirm,
}: {
  propRef: string | null
  onOpenChange: (o: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={!!propRef} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("common.delete")}</DialogTitle>
          <DialogDescription>{t("common.irreversible")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
