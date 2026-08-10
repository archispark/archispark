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

/**
 * Badge rectangulaire coloré par couche indiquant le type ArchiMate exact.
 */
export function ArchimateNotationBadge({
  elementType,
  size = 20,
  color: colorOverride,
}: {
  elementType?: string
  size?: number
  color?: string
}) {
  const layer = getLayer(elementType ?? "")
  const color = colorOverride ?? NOTATION_BADGE_COLORS[layer] ?? "#94a3b8"
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
