"use client"

import { Button } from "@workspace/ui/components/button"
import { FilterPanel } from "@/components/element-graph-filter-panel"
import type { EdgePathType } from "@/components/element-graph-markers"
import type { Direction } from "@/components/element-graph-layout"

const EDGE_PATH_LABELS: Record<EdgePathType, string> = {
  smoothstep: "Lisse",
  bezier: "Bezier",
  step: "Step",
  straight: "Droit",
}

/** Toolbar above the graph canvas: type filters, depth, indirect-relations, edge style and direction. */
export function GraphToolbar({
  availableElementTypes,
  availableRelTypes,
  hiddenElementTypes,
  hiddenRelTypes,
  onChangeElementTypes,
  onChangeRelTypes,
  depth,
  onChangeDepth,
  showIndirect,
  onChangeShowIndirect,
  edgePathType,
  onChangeEdgePathType,
  direction,
  onToggleDirection,
}: {
  availableElementTypes: string[]
  availableRelTypes: string[]
  hiddenElementTypes: Set<string>
  hiddenRelTypes: Set<string>
  onChangeElementTypes: (hidden: Set<string>) => void
  onChangeRelTypes: (hidden: Set<string>) => void
  depth: number
  onChangeDepth: (d: number) => void
  showIndirect: boolean
  onChangeShowIndirect: (indirect: boolean) => void
  edgePathType: EdgePathType
  onChangeEdgePathType: (type: EdgePathType) => void
  direction: Direction
  onToggleDirection: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      {/* Left: Filtres + Profondeur + Relations */}
      <div className="flex items-center gap-3">
        <FilterPanel
          availableElementTypes={availableElementTypes}
          availableRelTypes={availableRelTypes}
          hiddenElementTypes={hiddenElementTypes}
          hiddenRelTypes={hiddenRelTypes}
          onChangeElementTypes={onChangeElementTypes}
          onChangeRelTypes={onChangeRelTypes}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Profondeur</span>
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChangeDepth(d)}
              className={`h-6 w-6 rounded border text-xs transition-colors ${
                depth === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-ring hover:text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Relations</span>
          {([false, true] as const).map((indirect) => {
            const isDisabled = !indirect && depth > 1
            return (
              <button
                key={String(indirect)}
                type="button"
                onClick={() => onChangeShowIndirect(indirect)}
                disabled={isDisabled}
                className={`h-6 rounded border px-2 text-xs transition-colors ${
                  showIndirect === indirect
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDisabled
                      ? "cursor-not-allowed border-border text-muted-foreground opacity-40"
                      : "border-border text-muted-foreground hover:border-ring hover:text-foreground"
                }`}
              >
                {indirect ? "Indirect" : "Direct"}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Edge type + direction */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Edges</span>
          {(["smoothstep", "bezier", "step", "straight"] as const).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChangeEdgePathType(type)}
                className={`h-6 rounded border px-2 text-xs transition-colors ${
                  edgePathType === type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-ring hover:text-foreground"
                }`}
              >
                {EDGE_PATH_LABELS[type]}
              </button>
            )
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onToggleDirection}>
          {direction === "TB" ? "→" : "↓"}
        </Button>
      </div>
    </div>
  )
}
