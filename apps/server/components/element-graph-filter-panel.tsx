"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getLayer } from "@/lib/archimate-helpers"
import { Button } from "@workspace/ui/components/button"
import { SlidersHorizontal } from "lucide-react"

export function FilterPanel({
  availableElementTypes,
  availableRelTypes,
  hiddenElementTypes,
  hiddenRelTypes,
  onChangeElementTypes,
  onChangeRelTypes,
}: {
  availableElementTypes: string[]
  availableRelTypes: string[]
  hiddenElementTypes: Set<string>
  hiddenRelTypes: Set<string>
  onChangeElementTypes: (hidden: Set<string>) => void
  onChangeRelTypes: (hidden: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as HTMLElement)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const totalHidden = hiddenElementTypes.size + hiddenRelTypes.size

  const elTypesByLayer = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const t of availableElementTypes) {
      const layer = getLayer(t)
      ;(groups[layer] ??= []).push(t)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [availableElementTypes])

  function toggleEl(type: string) {
    const next = new Set(hiddenElementTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    onChangeElementTypes(next)
  }

  function toggleRel(type: string) {
    const next = new Set(hiddenRelTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    onChangeRelTypes(next)
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <SlidersHorizontal className="size-3.5" />
        Filtres
        {totalHidden > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground">
            {totalHidden}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-[420px] w-64 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-lg">
          {/* Element types */}
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Types d'éléments
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onChangeElementTypes(new Set())}
                >
                  Tout
                </button>
                <span className="text-muted-foreground">/</span>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() =>
                    onChangeElementTypes(new Set(availableElementTypes))
                  }
                >
                  Aucun
                </button>
              </div>
            </div>
            {elTypesByLayer.map(([layer, types]) => (
              <div key={layer} className="mb-2">
                <div className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
                  {layer}
                </div>
                {types.map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenElementTypes.has(type)}
                      onChange={() => toggleEl(type)}
                      className="shrink-0 rounded"
                    />
                    <span className="truncate text-xs">{type}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* Relation types */}
          {availableRelTypes.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Types de relations
                </span>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => onChangeRelTypes(new Set())}
                  >
                    Tout
                  </button>
                  <span className="text-muted-foreground">/</span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => onChangeRelTypes(new Set(availableRelTypes))}
                  >
                    Aucun
                  </button>
                </div>
              </div>
              {availableRelTypes.map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenRelTypes.has(type)}
                    onChange={() => toggleRel(type)}
                    className="shrink-0 rounded"
                  />
                  <span className="truncate text-xs">{type}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
