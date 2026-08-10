import type { IconPrim } from "@/lib/archimate/archimate-icons"
import { getLayer } from "@/lib/archimate-helpers"

// Palette du composant source `ofr-archimate-reports/notation-badge.tsx`.
const NOTATION_BADGE_COLORS: Record<string, string> = {
  Motivation: "#8b5cf6",
  Strategy: "#f97316",
  Business: "#f5c518",
  Application: "#0ea5e9",
  Technology: "#10b981",
  Physical: "#84cc16",
  Implementation: "#ec4899",
  Composite: "#94a3b8",
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

/**
 * Badge rectangulaire coloré par couche indiquant le type ArchiMate exact.
 */
export function ArchimateNotationBadge({
  elementType,
  size = 20,
}: {
  elementType?: string
  size?: number
}) {
  const layer = getLayer(elementType ?? "")
  const color = NOTATION_BADGE_COLORS[layer] ?? "#94a3b8"
  const label = elementType || "Unknown"
  const textColor =
    layer === "Business" || layer === "Physical" ? "#111827" : "#ffffff"

  return (
    <div
      title={label}
      style={{
        height: size,
        minWidth: size,
        padding: "0 6px",
        borderRadius: 6,
        background: color,
        border: "2px solid #ffffff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: textColor,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  )
}

export { renderIconPrim }
