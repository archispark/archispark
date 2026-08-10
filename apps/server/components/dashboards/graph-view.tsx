"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  MarkerType,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react"
import { cn } from "@workspace/ui/lib/utils"
import { ArchisparkReactFlow } from "@/components/archispark-react-flow"
import { LAYER_HEX_COLORS, getLayer } from "@/lib/archimate-helpers"
import { AppearancePanel } from "@/components/element-graph-appearance-panel"
import { FilterPanel } from "@/components/element-graph-filter-panel"
import type { EdgePathType } from "@/components/element-graph-markers"
import {
  ReactFlowFullscreenButton,
  useReactFlowFullscreen,
} from "@/components/react-flow-fullscreen"
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
        labelStyle: { fontSize: 10, opacity: e.dimmed ? 0.35 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1.5, opacity: e.dimmed ? 0.35 : 1 },
        type:
          edgePathType === "bezier"
            ? "default"
            : edgePathType === "step"
              ? "smoothstep"
              : edgePathType,
        pathOptions: edgePathType === "step" ? { borderRadius: 0 } : undefined,
      })),
    [visibleInputEdges, edgePathType]
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
    <div
      style={{ height: fullscreen ? "100dvh" : height }}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-background",
        fullscreen && "fixed inset-0 z-[60] rounded-none p-4"
      )}
    >
      <ArchisparkReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={DASHBOARD_NODE_TYPES}
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
        <Panel position="top-right">
          <div className="flex flex-col items-end gap-1">
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
          </div>
        </Panel>
        {panel ? <Panel position="top-left">{panel}</Panel> : null}
      </ArchisparkReactFlow>
    </div>
  )
}
