"use client"

import { useEffect, useRef, useState } from "react"
import { Palette } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { EdgePathType } from "@/components/element-graph-markers"
import type { Direction } from "@/components/element-graph-layout"

const EDGE_PATH_OPTIONS: Array<{ value: EdgePathType; label: string }> = [
  { value: "smoothstep", label: "Lisse" },
  { value: "bezier", label: "Bezier" },
  { value: "step", label: "Step" },
  { value: "straight", label: "Droit" },
]

export function AppearancePanel({
  edgePathType,
  onChangeEdgePathType,
  direction,
  onChangeDirection,
}: {
  edgePathType: EdgePathType
  onChangeEdgePathType: (type: EdgePathType) => void
  direction: Direction
  onChangeDirection: (direction: Direction) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as HTMLElement)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button
        size="icon"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        aria-label="Apparence"
        title="Apparence"
        aria-expanded={open}
      >
        <Palette className="size-3.5" />
      </Button>

      {open ? (
        <div className="absolute top-0 right-full z-50 mr-1 w-56 rounded-lg border border-border bg-background p-3 shadow-lg">
          <label className="mb-3 block text-xs font-medium text-muted-foreground">
            Style des arêtes
            <select
              value={edgePathType}
              onChange={(event) =>
                onChangeEdgePathType(event.target.value as EdgePathType)
              }
              className="mt-1.5 h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground"
            >
              {EDGE_PATH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted-foreground">
            Disposition
            <select
              value={direction}
              onChange={(event) =>
                onChangeDirection(event.target.value as Direction)
              }
              className="mt-1.5 h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="TB">Verticale</option>
              <option value="LR">Horizontale</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  )
}
