import { iconForType, type IconPrim } from "@/lib/archimate/archimate-icons"
import { LAYER_HEX_COLORS, getLayer } from "@/lib/archimate-helpers"

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
      return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={fill} />
    case "rect":
      return <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} fill={fill} />
  }
}

/**
 * Bulle ronde colorée par couche, portant le pictogramme du type ArchiMate
 * exact (BusinessRole, TechnologyService, …) — même glyphes que le coin
 * haut-droit de `view-canvas-node.tsx` (`iconForType`), factorisés ici pour
 * être réutilisés par les nœuds de graphe en lecture seule
 * (`components/dashboards/graph-view.tsx`). Voir docs/architecture.md#dashboards
 * pour l'alignement visuel entre les deux styles de nœuds ReactFlow.
 */
export function ArchimateNotationBadge({
  elementType,
  size = 20,
}: {
  elementType?: string
  size?: number
}) {
  const prims = iconForType(elementType)
  if (!prims) return null
  const layer = getLayer(elementType ?? "")
  const color = LAYER_HEX_COLORS[layer] ?? "#64748b"
  return (
    <div
      title={elementType}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: "2px solid #ffffff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {prims.map(renderIconPrim)}
      </svg>
    </div>
  )
}

export { renderIconPrim }
