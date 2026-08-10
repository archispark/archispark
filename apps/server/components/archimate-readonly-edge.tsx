"use client"

import { useContext } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react"
import { archimateEdgeStyle } from "@/components/archimate-edge-style"
import { EdgeTypeContext, getStepPath } from "@/components/react-flow-edge-path"

export function ArchimateReadonlyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  style,
}: EdgeProps) {
  const edgePathType = useContext(EdgeTypeContext)
  const pathArgs = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  }
  const [path, labelX, labelY] =
    edgePathType === "bezier"
      ? getBezierPath(pathArgs)
      : edgePathType === "straight"
        ? getStraightPath({ sourceX, sourceY, targetX, targetY })
        : edgePathType === "step"
          ? getStepPath({ sourceX, sourceY, targetX, targetY })
          : getSmoothStepPath(pathArgs)
  const relationshipType = data?.relationshipType as string | undefined
  const notation = archimateEdgeStyle(relationshipType)

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#222",
          strokeWidth: 1.2,
          fill: "none",
          ...style,
          strokeDasharray: notation.strokeDasharray,
        }}
        markerStart={notation.markerStart}
        markerEnd={notation.markerEnd}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[9px] whitespace-nowrap text-muted-foreground">
              {label as string}
            </span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

export const ARCHIMATE_READONLY_EDGE_TYPES = {
  archimate: ArchimateReadonlyEdge,
}
