/**
 * Richer @xyflow/react mock for view-canvas-interactions-*.test.tsx: captures
 * the event handlers passed to <ReactFlow> (via `shared`) so tests can invoke
 * them directly without a real React Flow canvas.
 */
import { vi } from "vitest"
import type React from "react"
import { shared } from "./view-canvas-interactions-mocks"

type NodeRenderer = React.ComponentType<{
  id: string
  data: Record<string, unknown>
  selected: boolean
}>
type EdgeRenderer = React.ComponentType<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: string
  targetPosition: string
  data: Record<string, unknown>
  label: unknown
  selected: boolean
}>

export const reactFlowMock = {
  ReactFlow: ({
    nodes,
    edges,
    nodeTypes = {},
    edgeTypes = {},
    onConnect,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    onNodeDoubleClick,
    onEdgeDoubleClick,
    onReconnect,
    children,
  }: {
    nodes: Array<{
      id: string
      type?: string
      data: Record<string, unknown>
      selected?: boolean
    }>
    edges: Array<{
      id: string
      type?: string
      data: Record<string, unknown>
      label?: unknown
      selected?: boolean
    }>
    nodeTypes?: Record<string, NodeRenderer>
    edgeTypes?: Record<string, EdgeRenderer>
    onConnect?: (p: { source: string | null; target: string | null }) => void
    onNodeDragStop?: (
      _e: unknown,
      node: {
        id: string
        position: { x: number; y: number }
        parentId?: string
      }
    ) => void
    onNodesDelete?: (deleted: { id: string }[]) => void
    onEdgesDelete?: (deleted: { id: string }[]) => void
    onNodeDoubleClick?: (
      _e: unknown,
      node: { id: string; data: Record<string, unknown> }
    ) => void
    onEdgeDoubleClick?: (
      _e: unknown,
      edge: { id: string; label: unknown }
    ) => void
    onReconnect?: (
      oldEdge: {
        id: string
        source: string
        target: string
        sourceHandle: string | null
        targetHandle: string | null
      },
      newConn: {
        source: string | null
        target: string | null
        sourceHandle: string | null
        targetHandle: string | null
      }
    ) => void
    children?: React.ReactNode
  }) => {
    // Capture handlers for direct invocation in tests
    if (onConnect) shared.onConnect = onConnect
    if (onNodeDragStop) shared.onNodeDragStop = onNodeDragStop
    if (onNodesDelete) shared.onNodesDelete = onNodesDelete
    if (onEdgesDelete) shared.onEdgesDelete = onEdgesDelete
    if (onNodeDoubleClick) shared.onNodeDoubleClick = onNodeDoubleClick
    if (onEdgeDoubleClick) shared.onEdgeDoubleClick = onEdgeDoubleClick
    if (onReconnect) shared.onReconnect = onReconnect

    return (
      <div data-testid="reactflow">
        <span data-testid="node-count">{nodes.length}</span>
        <span data-testid="edge-count">{edges.length}</span>
        {children}
        {nodes.map((n) => {
          const Comp = n.type ? nodeTypes[n.type] : undefined
          return Comp ? (
            <div key={n.id} data-testid={`node-${n.id}`}>
              <Comp id={n.id} data={n.data} selected={n.selected ?? false} />
            </div>
          ) : null
        })}
        {edges.map((e) => {
          const Comp = e.type ? edgeTypes[e.type] : undefined
          return Comp ? (
            <Comp
              key={e.id}
              id={e.id}
              sourceX={0}
              sourceY={0}
              targetX={100}
              targetY={100}
              sourcePosition="bottom"
              targetPosition="top"
              data={e.data ?? {}}
              label={e.label}
              selected={shared.edgeSelectedOverride || (e.selected ?? false)}
            />
          ) : null
        })}
      </div>
    )
  },
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  BaseEdge: () => null,
  EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  Panel: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  getSmoothStepPath: () => ["M0,0 L1,1", 0, 0],
  getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  getViewportForBounds: () => ({ x: 0, y: 0, zoom: 1 }),
  reconnectEdge: (_old: unknown, _new: unknown, eds: unknown[]) => eds,
  useNodesState: (initial: unknown[]) => {
    const [nodes, setNodes] = [initial, vi.fn()]
    return [nodes, setNodes, vi.fn()]
  },
  useEdgesState: (initial: unknown[]) => {
    const [edges, setEdges] = [initial, vi.fn()]
    return [edges, setEdges, vi.fn()]
  },
  useReactFlow: () => ({
    getNodes: () => [],
    setEdges: vi.fn(),
    setNodes: vi.fn(),
    screenToFlowPosition: (p: { x: number; y: number }) => p,
  }),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}
