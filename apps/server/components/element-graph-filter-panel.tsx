"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getLayer } from "@/lib/archimate-helpers"
import { Button } from "@workspace/ui/components/button"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

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
  const [selector, setSelector] = useState<"elements" | "relations" | null>(
    null
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as HTMLElement)) {
        setOpen(false)
        setSelector(null)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

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
        size="icon"
        variant="outline"
        onClick={() => {
          setOpen((v) => !v)
          setSelector(null)
        }}
        aria-label="Filtres"
        title="Filtres"
      >
        <SlidersHorizontal className="size-3.5" />
      </Button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border border-border bg-background p-3 shadow-lg">
          {/* Element types */}
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Types d{"'"}éléments
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
            <div className="relative">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded border border-input px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() =>
                  setSelector((value) =>
                    value === "elements" ? null : "elements"
                  )
                }
                aria-expanded={selector === "elements"}
              >
                <span>
                  {availableElementTypes.length - hiddenElementTypes.size}/
                  {availableElementTypes.length} sélectionnés
                </span>
                <ChevronDown className="size-3.5" />
              </button>
              {selector === "elements" && (
                <div className="absolute top-full right-0 z-[60] mt-1 max-h-64 w-64 overflow-y-auto rounded-md border border-border bg-background p-2 shadow-lg">
                  {elTypesByLayer.map(([layer, types]) => (
                    <div key={layer} className="mb-2 last:mb-0">
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
              )}
            </div>
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
              <div className="relative">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded border border-input px-2 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() =>
                    setSelector((value) =>
                      value === "relations" ? null : "relations"
                    )
                  }
                  aria-expanded={selector === "relations"}
                >
                  <span>
                    {availableRelTypes.length - hiddenRelTypes.size}/
                    {availableRelTypes.length} sélectionnés
                  </span>
                  <ChevronDown className="size-3.5" />
                </button>
                {selector === "relations" && (
                  <div className="absolute top-full right-0 z-[60] mt-1 max-h-64 w-64 overflow-y-auto rounded-md border border-border bg-background p-2 shadow-lg">
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
