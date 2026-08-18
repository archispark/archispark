"use client"

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

type FlowDiagramProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = {
  nodes: NodeType[]
  edges: EdgeType[]
  height?: number
}

/**
 * Read-only diagram shell for documentation pages: fixed height, no
 * editing (dragging/connecting/selecting), fitted on mount. Scroll-to-zoom
 * is off so the diagram never traps normal page scrolling — pan/pinch-zoom
 * and the zoom controls still let a reader dig into a busy diagram.
 */
export function FlowDiagram<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>({ nodes, edges, height = 360 }: FlowDiagramProps<NodeType, EdgeType>) {
  return (
    <div
      className="docs-flow-diagram not-prose my-6 overflow-hidden rounded-lg border"
      style={{ height }}
    >
      <style>{`
        .docs-flow-diagram .react-flow__node {
          background: var(--color-fd-card);
          color: var(--color-fd-card-foreground);
          border-color: var(--color-fd-border);
        }
        .docs-flow-diagram .react-flow__edge-path,
        .docs-flow-diagram .react-flow__arrowhead path {
          stroke: var(--color-fd-muted-foreground);
        }
        .docs-flow-diagram .react-flow__edge-text {
          fill: var(--color-fd-foreground);
        }
        .docs-flow-diagram .react-flow__edge-textbg {
          fill: var(--color-fd-background);
        }
        .docs-flow-diagram .react-flow__controls-button {
          background: var(--color-fd-card);
          border-color: var(--color-fd-border);
          fill: var(--color-fd-card-foreground);
        }
        .docs-flow-diagram .react-flow__controls-button:hover {
          background: var(--color-fd-muted);
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
