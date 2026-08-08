import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import { NODE_W, NODE_H } from "@/components/element-graph-markers"

export type Direction = "TB" | "LR"

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: Direction
): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 })
  for (const node of nodes)
    g.setNode(node.id, { width: NODE_W, height: NODE_H })
  for (const edge of edges) g.setEdge(edge.source, edge.target)
  dagre.layout(g)
  return nodes.map((node) => {
    const { x, y } = g.node(node.id)
    return { ...node, position: { x: x - NODE_W / 2, y: y - NODE_H / 2 } }
  })
}
