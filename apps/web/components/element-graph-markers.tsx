"use client"

import { createContext } from "react"

export const NODE_W = 150
export const NODE_H = 60

export type EdgePathType = "smoothstep" | "bezier" | "step" | "straight"

export function getStepPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}): [string, number, number] {
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  return [
    `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`,
    midX,
    midY,
  ]
}

export const EdgeTypeContext = createContext<EdgePathType>("smoothstep")

// ── ArchiMate edge markers ────────────────────────────────────────────────────

export interface ArchiEdgeStyle {
  strokeDasharray?: string
  markerStart?: string
  markerEnd?: string
}

export function archimateEdgeStyle(type?: string): ArchiEdgeStyle {
  switch (type) {
    case "Composition":
      return { markerStart: "url(#eg-diamond-filled)" }
    case "Aggregation":
      return { markerStart: "url(#eg-diamond-open)" }
    case "Assignment":
      return {
        markerStart: "url(#eg-dot-filled)",
        markerEnd: "url(#eg-arrow-open)",
      }
    case "Realization":
      return { markerEnd: "url(#eg-triangle-open)", strokeDasharray: "6 3" }
    case "Serving":
    case "UsedBy":
      return { markerEnd: "url(#eg-arrow-open)" }
    case "Triggering":
      return { markerEnd: "url(#eg-arrow-filled)" }
    case "Flow":
      return { markerEnd: "url(#eg-arrow-filled)", strokeDasharray: "6 3" }
    case "Access":
      return { markerEnd: "url(#eg-arrow-open)", strokeDasharray: "4 3" }
    case "Influence":
      return { markerEnd: "url(#eg-arrow-open)", strokeDasharray: "6 3" }
    case "Specialization":
      return { markerEnd: "url(#eg-triangle-open)" }
    case "Association":
    default:
      return {}
  }
}

// Marker SVG defs — must be in the DOM for url(#…) references to resolve.
// IDs are prefixed with "eg-" to avoid collisions with view-canvas markers.
export const MARKER_DEFS = (
  <svg
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    aria-hidden
  >
    <defs>
      <marker
        id="eg-diamond-filled"
        viewBox="0 0 14 10"
        refX="0"
        refY="5"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker
        id="eg-diamond-open"
        viewBox="0 0 14 10"
        refX="0"
        refY="5"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker
        id="eg-triangle-open"
        viewBox="0 0 12 10"
        refX="11"
        refY="5"
        markerWidth="12"
        markerHeight="10"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,0 L12,5 L0,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker
        id="eg-arrow-filled"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,0 L10,5 L0,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker
        id="eg-arrow-open"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M0,0 L10,5 L0,10"
          fill="none"
          stroke="#222"
          strokeWidth="1.2"
        />
      </marker>
      <marker
        id="eg-dot-filled"
        viewBox="0 0 16 16"
        refX="9"
        refY="8"
        markerWidth="16"
        markerHeight="16"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <circle
          cx="7"
          cy="8"
          r="7"
          fill="#000"
          stroke="#fff"
          strokeWidth="1.5"
        />
      </marker>
    </defs>
  </svg>
)
