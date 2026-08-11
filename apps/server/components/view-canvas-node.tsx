"use client"

import { useContext } from "react"
import type React from "react"
import { NodeResizer, Handle, Position, type NodeProps } from "@xyflow/react"
import { updateViewNode } from "@/lib/api"
import { getLayer } from "@/lib/archimate-helpers"
import { ArchimateLayerBadge } from "@/components/archimate-layer-badge"
import { ArchimateNotationBadge } from "@/components/archimate-notation-badge"
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

export function ArchiNode({ id, data, selected }: NodeProps) {
  const viewId = useContext(ViewIdContext)
  const elementType = (data.elementType as string | undefined) ?? undefined
  const hasChildren = Boolean(data.hasChildren)
  const imageUrl = (data.imageUrl as string | undefined) ?? undefined
  const { bg, border } = colorFor(elementType)
  const containerStyle: React.CSSProperties = hasChildren
    ? {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 8,
        background: bg,
        color: "#111",
        padding: "16px 6px 6px 6px",
        fontSize: 11,
        textAlign: "left",
        overflow: "visible",
        cursor: "grab",
        position: "relative",
      }
    : {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 8,
        background: bg,
        color: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px 6px 42px",
        fontSize: 11,
        textAlign: "center",
        overflow: "visible",
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
      <div style={{ position: "absolute", top: -13, right: -4, zIndex: 1 }}>
        <ArchimateNotationBadge
          elementType={elementType}
          size={18}
          color={border}
        />
      </div>
      {!hasChildren ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 6,
            transform: "translateY(-50%)",
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <ArchimateLayerBadge layer={getLayer(elementType ?? "")} />
          )}
        </div>
      ) : null}
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
        <span
          title={String(data.label ?? "")}
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            lineHeight: 1.25,
          }}
        >
          {String(data.label ?? "")}
        </span>
      )}
    </div>
  )
}
