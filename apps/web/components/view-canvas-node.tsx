"use client"

import { useContext } from "react"
import type React from "react"
import { NodeResizer, Handle, Position, type NodeProps } from "@xyflow/react"
import { updateViewNode } from "@/lib/api"
import { iconForType, type IconPrim } from "./archimate-icons"
import { colorFor } from "@/components/view-canvas-colors"
import { ViewIdContext } from "@/components/view-canvas-context"

const HANDLE_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#fff",
  border: "1px solid #555",
  borderRadius: "50%",
  opacity: 0,
  transition: "opacity 0.15s",
}

function renderIconPrim(p: IconPrim, i: number) {
  const fill = "fill" in p && p.fill ? "currentColor" : "none"
  switch (p.tag) {
    case "path":
      return <path key={i} d={p.d} fill={fill} />
    case "polygon":
      return <polygon key={i} points={p.points.join(" ")} fill={fill} />
    case "polyline":
      return <polyline key={i} points={p.points.join(" ")} fill="none" />
    case "circle":
      return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={fill} />
    case "ellipse":
      return (
        <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={fill} />
      )
    case "rect":
      return (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.width}
          height={p.height}
          rx={p.rx}
          fill={fill}
        />
      )
  }
}

// The ArchiMate type icon, drawn in the element's top-right corner. The glyph
// coordinates are anchored to the corner (x ≤ 0, y ≥ 0), so the overlay SVG is
// pinned flush to the top-right and its viewBox places x=0 at the right edge.
function ArchimateTypeIcon({
  elementType,
  color,
}: {
  elementType?: string
  color: string
}) {
  const prims = iconForType(elementType)
  if (!prims) return null
  return (
    <svg
      width={28}
      height={30}
      viewBox="-28 0 28 30"
      style={{
        position: "absolute",
        top: 2,
        right: 2,
        overflow: "visible",
        pointerEvents: "none",
        color,
      }}
      stroke="currentColor"
      strokeWidth={1}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {prims.map(renderIconPrim)}
    </svg>
  )
}

export function ArchiNode({ id, data, selected }: NodeProps) {
  const viewId = useContext(ViewIdContext)
  const elementType = (data.elementType as string | undefined) ?? undefined
  const hasChildren = Boolean(data.hasChildren)
  const { bg, border } = colorFor(elementType)
  const containerStyle: React.CSSProperties = hasChildren
    ? {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: bg,
        color: "#111",
        padding: "16px 6px 6px 6px",
        fontSize: 11,
        textAlign: "left",
        overflow: "hidden",
        cursor: "grab",
        position: "relative",
      }
    : {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: bg,
        color: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        fontSize: 11,
        textAlign: "center",
        overflow: "hidden",
        cursor: "grab",
        position: "relative",
      }
  return (
    <div style={containerStyle}>
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={30}
        lineStyle={{ borderColor: "#3b82f6" }}
        handleStyle={{
          width: 8,
          height: 8,
          background: "#fff",
          border: "1px solid #3b82f6",
          borderRadius: 2,
        }}
        onResizeEnd={(_e, params) => {
          if (!viewId) return
          updateViewNode(viewId, id, {
            w: Math.round(params.width),
            h: Math.round(params.height),
          }).catch((err) => console.error("updateViewNode resize failed", err))
        }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="s-top"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="s-right"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="s-bottom"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="s-left"
        style={HANDLE_STYLE}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="t-top"
        style={HANDLE_STYLE}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="t-right"
        style={HANDLE_STYLE}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="t-bottom"
        style={HANDLE_STYLE}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="t-left"
        style={HANDLE_STYLE}
      />
      <ArchimateTypeIcon elementType={elementType} color={border} />
      {hasChildren ? (
        <span
          style={{
            position: "absolute",
            top: 3,
            left: 6,
            fontWeight: 500,
            pointerEvents: "none",
          }}
        >
          {String(data.label ?? "")}
        </span>
      ) : (
        <span>{String(data.label ?? "")}</span>
      )}
    </div>
  )
}
