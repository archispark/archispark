import dagre, { graphlib } from "@dagrejs/dagre"

// Taille permanente partagée par Dagre et le composant React Flow. La
// largeur correspond à celle qu'atteignait auparavant le libellé long
// "Detailed Insight in Customer Behavior".
export const DASHBOARD_NODE_WIDTH = 220
export const DASHBOARD_NODE_HEIGHT = 60

/** Sens du layout automatique : horizontal (gauche→droite) ou vertical (haut→bas). */
export type GraphDirection = "LR" | "TB"

/**
 * Calcule des positions (x, y) automatiques pour un ensemble de nœuds/arêtes
 * via dagre (layout hiérarchique en couches), pour le graphe de dashboard en
 * lecture seule (`components/dashboards/graph-view.tsx`) — distinct de
 * `components/element-graph-layout.ts` (nœuds de taille fixe, sans notion de
 * `rankGroup`, utilisé par l'onglet « Relations » d'un élément).
 */
export function applyDagreLayout<
  N extends { id: string; label: string; rankGroup?: string },
  E extends { id: string; source: string; target: string },
>(
  nodes: N[],
  edges: E[],
  direction: GraphDirection = "LR"
): (N & { x: number; y: number })[] {
  // "multigraph" : deux éléments peuvent être reliés par plusieurs relations
  // dans le même sens ; un id d'arête unique évite qu'elles s'écrasent.
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 28,
    ranksep: 56,
    acyclicer: "greedy",
  })

  for (const node of nodes) {
    g.setNode(node.id, {
      width: DASHBOARD_NODE_WIDTH,
      height: DASHBOARD_NODE_HEIGHT,
    })
  }
  for (const edge of edges) {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue
    g.setEdge(edge.source, edge.target, {}, edge.id)
  }

  try {
    dagre.layout(g)
  } catch {
    // dagre a un bug interne rare (état cumulatif au niveau du module) qui
    // peut le faire planter sur des graphes très denses/cycliques. On
    // retombe sur une grille simple plutôt que de casser le rendu.
    return gridFallback(nodes, direction)
  }

  alignRankGroups(g, nodes, direction)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      ...node,
      x: pos ? pos.x - DASHBOARD_NODE_WIDTH / 2 : 0,
      y: pos ? pos.y - DASHBOARD_NODE_HEIGHT / 2 : 0,
    }
  })
}

/**
 * Aligne, après coup, les nœuds partageant un même `rankGroup` (voir
 * `PanelResult.graph.rankGroups`) sur une seule colonne (LR) ou rangée (TB) —
 * dagre n'offre pas de contrainte "même rang" native, d'où ce recalage
 * direct des coordonnées après le layout normal.
 */
function alignRankGroups(
  g: graphlib.Graph,
  nodes: { id: string; rankGroup?: string }[],
  direction: GraphDirection
): void {
  const axis = direction === "LR" ? "x" : "y"
  const groups = new Map<string, string[]>()
  for (const node of nodes) {
    if (!node.rankGroup || !g.hasNode(node.id)) continue
    ;(
      groups.get(node.rankGroup) ??
      groups.set(node.rankGroup, []).get(node.rankGroup)!
    ).push(node.id)
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue
    let target = g.node(members[0]!)
    for (const id of members) {
      const candidate = g.node(id)
      if (
        candidate.rank !== undefined &&
        (target.rank === undefined || candidate.rank < target.rank)
      ) {
        target = candidate
      }
    }
    for (const id of members) g.node(id)[axis] = target[axis]
  }
}

function gridFallback<N extends { id: string; label: string }>(
  nodes: N[],
  direction: GraphDirection
): (N & { x: number; y: number })[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  return nodes.map((node, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    return {
      ...node,
      x: (direction === "LR" ? row : col) * (DASHBOARD_NODE_WIDTH + 40),
      y: (direction === "LR" ? col : row) * (DASHBOARD_NODE_HEIGHT + 40),
    }
  })
}
