"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  Panel,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react"
import { ArchisparkReactFlow } from "@/components/archispark-react-flow"
import { LAYER_HEX_COLORS, getLayer } from "@/lib/archimate-helpers"
import { AppearancePanel } from "@/components/element-graph-appearance-panel"
import { FilterPanel } from "@/components/element-graph-filter-panel"
import { ARCHIMATE_READONLY_EDGE_TYPES } from "@/components/archimate-readonly-edge"
import {
  EdgeTypeContext,
  type EdgePathType,
} from "@/components/react-flow-edge-path"
import {
  FullscreenContainer,
  ReactFlowFullscreenButton,
  useReactFlowFullscreen,
} from "@/components/react-flow-fullscreen"
import { CanvasToolbarPanel } from "@/components/canvas-toolbar-panel"
import {
  applyDagreLayout,
  DASHBOARD_NODE_HEIGHT,
  DASHBOARD_NODE_WIDTH,
  type GraphDirection,
} from "./dagre-layout"
import {
  DASHBOARD_HANDLE_POSITIONS,
  DASHBOARD_NODE_TYPES,
  type DashboardArchiNode,
} from "./graph-node"

// Zoom minimal autorisé lors du recadrage automatique : plus bas que le
// défaut de React Flow (0.5) pour qu'un grand graphe puisse toujours tenir
// entièrement dans la vue.
const MIN_ZOOM = 0.05

export interface GraphViewNode {
  id: string
  label: string
  type: string
  emphasized?: boolean
  /** Estompé (faible opacité) : pour donner du contexte autour d'un sous-ensemble mis en avant. */
  dimmed?: boolean
  rankGroup?: string
}

export interface GraphViewEdge {
  id: string
  source: string
  target: string
  type: string
  dimmed?: boolean
}

export function GraphView(props: {
  nodes: GraphViewNode[]
  edges: GraphViewEdge[]
  height?: number | string
  direction?: GraphDirection
  nodeHref?: (id: string) => string
  panel?: ReactNode
}) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  )
}

function GraphViewInner({
  nodes: inputNodes,
  edges: inputEdges,
  height = 480,
  direction: defaultDirection = "LR",
  nodeHref,
  panel,
}: {
  nodes: GraphViewNode[]
  edges: GraphViewEdge[]
  height?: number | string
  direction?: GraphDirection
  nodeHref?: (id: string) => string
  panel?: ReactNode
}) {
  const router = useRouter()
  const { fitView } = useReactFlow()
  const { fullscreen, toggleFullscreen } = useReactFlowFullscreen()
  const [direction, setDirection] = useState(defaultDirection)
  const [edgePathType, setEdgePathType] = useState<EdgePathType>("smoothstep")
  const [hiddenElementTypes, setHiddenElementTypes] = useState<Set<string>>(
    new Set()
  )
  const [hiddenRelTypes, setHiddenRelTypes] = useState<Set<string>>(new Set())

  const availableElementTypes = useMemo(
    () => [...new Set(inputNodes.map((node) => node.type))].sort(),
    [inputNodes]
  )
  const availableRelTypes = useMemo(
    () => [...new Set(inputEdges.map((edge) => edge.type))].sort(),
    [inputEdges]
  )
  const visibleInputNodes = useMemo(
    () => inputNodes.filter((node) => !hiddenElementTypes.has(node.type)),
    [inputNodes, hiddenElementTypes]
  )
  const visibleInputEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleInputNodes.map((node) => node.id))
    return inputEdges.filter(
      (edge) =>
        !hiddenRelTypes.has(edge.type) &&
        visibleNodeIds.has(edge.source) &&
        visibleNodeIds.has(edge.target)
    )
  }, [inputEdges, visibleInputNodes, hiddenRelTypes])

  const computedNodes = useMemo<DashboardArchiNode[]>(() => {
    const { target, source } = DASHBOARD_HANDLE_POSITIONS[direction]
    const laidOut = applyDagreLayout(
      visibleInputNodes.map((n) => ({
        id: n.id,
        label: n.label,
        rankGroup: n.rankGroup,
      })),
      visibleInputEdges,
      direction
    )
    const positionById = new Map(laidOut.map((n) => [n.id, { x: n.x, y: n.y }]))
    return visibleInputNodes.map((n) => {
      const layer = getLayer(n.type)
      const color = LAYER_HEX_COLORS[layer] ?? "#64748b"
      return {
        id: n.id,
        type: "archi",
        position: positionById.get(n.id) ?? { x: 0, y: 0 },
        data: { label: n.label, layer, type: n.type, emphasized: n.emphasized },
        targetPosition: target,
        sourcePosition: source,
        style: {
          background: n.emphasized ? `${color}26` : "var(--card)",
          color: "var(--card-foreground)",
          border: `${n.emphasized ? 3 : 2}px solid ${color}`,
          borderRadius: 8,
          padding: "6px 10px 6px 42px",
          fontSize: 12,
          boxSizing: "border-box",
          width: DASHBOARD_NODE_WIDTH,
          height: DASHBOARD_NODE_HEIGHT,
          display: "flex",
          alignItems: "center",
          opacity: n.dimmed ? 0.35 : 1,
        },
      }
    })
  }, [visibleInputNodes, visibleInputEdges, direction])

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes)
  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes])

  const edges = useMemo<Edge[]>(
    () =>
      visibleInputEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.type,
        type: "archimate",
        data: { relationshipType: e.type },
        style: { strokeWidth: 1.5, opacity: e.dimmed ? 0.35 : 1 },
      })),
    [visibleInputEdges]
  )

  useEffect(() => {
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 200, minZoom: MIN_ZOOM })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [computedNodes, edges, fitView])

  return (
    <FullscreenContainer
      fullscreen={fullscreen}
      style={{ height: fullscreen ? "100dvh" : height }}
      className="overflow-hidden rounded-lg border border-border bg-background"
      fullscreenClassName="rounded-none"
    >
      <EdgeTypeContext.Provider value={edgePathType}>
        <ArchisparkReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={DASHBOARD_NODE_TYPES}
          edgeTypes={ARCHIMATE_READONLY_EDGE_TYPES}
          onNodesChange={onNodesChange}
          fitView
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodeClick={
            nodeHref ? (_, node) => router.push(nodeHref(node.id)) : undefined
          }
          controlsProps={{ showInteractive: false }}
        >
          <CanvasToolbarPanel>
            <FilterPanel
              availableElementTypes={availableElementTypes}
              availableRelTypes={availableRelTypes}
              hiddenElementTypes={hiddenElementTypes}
              hiddenRelTypes={hiddenRelTypes}
              onChangeElementTypes={setHiddenElementTypes}
              onChangeRelTypes={setHiddenRelTypes}
            />
            <AppearancePanel
              edgePathType={edgePathType}
              onChangeEdgePathType={setEdgePathType}
              direction={direction}
              onChangeDirection={setDirection}
            />
            <ReactFlowFullscreenButton
              fullscreen={fullscreen}
              onToggle={toggleFullscreen}
            />
          </CanvasToolbarPanel>
          {panel ? <Panel position="top-left">{panel}</Panel> : null}
        </ArchisparkReactFlow>
      </EdgeTypeContext.Provider>
    </FullscreenContainer>
  )
}
