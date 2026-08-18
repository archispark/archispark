import {
  AppWindow,
  Box,
  Building2,
  Compass,
  GitBranch,
  MapPin,
  Server,
  Target,
  type LucideIcon,
} from "lucide-react"

const ICONS_BY_LAYER: Record<string, LucideIcon> = {
  Motivation: Target,
  Strategy: Compass,
  Business: Building2,
  Application: AppWindow,
  Technology: Server,
  Physical: MapPin,
  Implementation: GitBranch,
  Composite: Box,
}

/** Icône générique de couche affichée dans le corps d'un nœud de graphe. */
export function ArchimateLayerBadge({
  layer,
  size = 28,
}: {
  layer: string
  size?: number
}) {
  const Icon = ICONS_BY_LAYER[layer] ?? Box

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
      <Icon size={size * 0.61} strokeWidth={1.75} />
    </div>
  )
}
