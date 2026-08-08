import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers"

const JUNCTION_TYPES = new Set(["Junction", "AndJunction", "OrJunction"])

/**
 * Bordure/fond d'un nœud de vue, dérivés de `LAYER_HEX_COLORS`
 * (`lib/archimate-helpers.ts`) — même palette que les autres graphes
 * ReactFlow de l'application (`element-graph-node-types.tsx`,
 * `components/dashboards/graph-view.tsx`), plutôt qu'une palette dédiée à ce
 * seul composant. Le fond est une teinte à 10% d'opacité de la bordure,
 * même technique que celle déjà utilisée pour les nœuds mis en avant du
 * graphe de dashboard (`${color}26`).
 */
export function colorFor(elementType?: string): { bg: string; border: string } {
  if (elementType && JUNCTION_TYPES.has(elementType)) return { bg: "#000000", border: "#000000" }
  const layer = getLayer(elementType ?? "")
  const border = LAYER_HEX_COLORS[layer] ?? LAYER_HEX_COLORS["Composite"]!
  return { bg: `${border}1a`, border }
}
