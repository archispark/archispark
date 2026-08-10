"use client"

import { Button } from "@workspace/ui/components/button"
import type { EdgePathType } from "@/components/element-graph-markers"
import type { Direction } from "@/components/element-graph-layout"

const EDGE_PATH_LABELS: Record<EdgePathType, string> = {
  smoothstep: "Lisse",
  bezier: "Bezier",
  step: "Step",
  straight: "Droit",
}

/** Toolbar above the graph canvas: edge style and direction. */
export function GraphToolbar({
  edgePathType,
  onChangeEdgePathType,
  direction,
  onToggleDirection,
}: {
  edgePathType: EdgePathType
  onChangeEdgePathType: (type: EdgePathType) => void
  direction: Direction
  onToggleDirection: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      <div className="ml-auto flex items-center gap-3">
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
