"use client"

import { useContext } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react"
import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers"
import { ArchimateLayerBadge } from "@/components/archimate-layer-badge"
import { ArchimateNotationBadge } from "@/components/archimate-notation-badge"
import {
  NODE_W,
  NODE_H,
  EdgeTypeContext,
  archimateEdgeStyle,
  getStepPath,
} from "@/components/element-graph-markers"

// ── Custom edge ───────────────────────────────────────────────────────────────

export function ArchiEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
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
  const relType = (data?.relationshipType as string | undefined) ?? undefined
  const archi = archimateEdgeStyle(relType)

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#222",
          strokeWidth: 1.2,
          fill: "none",
          ...(archi.strokeDasharray
            ? { strokeDasharray: archi.strokeDasharray }
            : {}),
        }}
        markerStart={archi.markerStart}
        markerEnd={archi.markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            <span
              style={{
                background: "#fff",
                padding: "1px 5px",
                fontSize: 9,
                border: "1px solid #ddd",
                borderRadius: 3,
                color: "#475569",
                whiteSpace: "nowrap",
              }}
            >
              {label as string}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ── Node renderer ─────────────────────────────────────────────────────────────

export function ArchiNode({ data }: NodeProps) {
  const d = data as {
    label: string
    elementType: string
    isCentral: boolean
    hasConflict: boolean
    onClick?: () => void
  }
  const layer = getLayer(d.elementType)
  const color = LAYER_HEX_COLORS[layer] ?? "#64748b"
  const borderColor = color
  const borderWidth = d.isCentral ? 3 : 1.5
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <div
        onClick={d.onClick}
        style={{
          width: NODE_W,
          height: NODE_H,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 8,
          background: d.isCentral ? `${color}22` : "white",
          display: "flex",
          alignItems: "center",
          padding: "6px 10px 6px 42px",
          cursor: d.isCentral ? "default" : "pointer",
          boxShadow: d.isCentral
            ? `0 0 0 4px ${borderColor}33, 0 2px 10px rgba(0,0,0,0.12)`
            : "0 1px 4px rgba(0,0,0,0.08)",
          textAlign: "left",
          userSelect: "none",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 6,
            transform: "translateY(-50%)",
          }}
        >
          <ArchimateLayerBadge layer={layer} />
        </div>
        <div style={{ position: "absolute", top: -13, right: -4 }}>
          <ArchimateNotationBadge
            elementType={d.elementType}
            size={18}
            color={color}
          />
        </div>
        {d.hasConflict && (
          <span
            style={{
              position: "absolute",
              bottom: 3,
              right: 5,
              fontSize: 9,
              color: "#dc2626",
              fontWeight: 700,
            }}
          >
            ✕
          </span>
        )}
        <div
          title={d.label || "—"}
          style={{
            fontSize: d.isCentral ? 13 : 12,
            fontWeight: d.isCentral ? 700 : 500,
            color: "#1e293b",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            minWidth: 0,
          }}
        >
          {d.label || "—"}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </>
  )
}

export const NODE_TYPES = { archimateNode: ArchiNode }
export const EDGE_TYPES = { archiEdge: ArchiEdge }
