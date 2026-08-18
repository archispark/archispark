import { ARCHIMATE_TYPE_ICONS } from "@workspace/image-library"
import { getLayer } from "@/lib/archimate-helpers"
import { ArchimateLayerBadge } from "@/components/archimate-layer-badge"

/** Icône précise par type ArchiMate affichée dans le corps d'un nœud de graphe. */
export function ArchimateTypeBadge({
  elementType,
  size = 28,
}: {
  elementType: string | undefined
  size?: number
}) {
  const Icon = elementType ? ARCHIMATE_TYPE_ICONS[elementType] : undefined
  if (!Icon)
    return (
      <ArchimateLayerBadge layer={getLayer(elementType ?? "")} size={size} />
    )

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--card)",
        border: "2px solid #9ca3af",
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted-foreground)",
        flexShrink: 0,
      }}
    >
      <Icon width={size * 0.61} height={size * 0.61} />
    </div>
  )
}
