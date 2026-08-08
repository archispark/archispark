"use client"

import { useEffect, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@workspace/ui/lib/utils"
import { LAYER_HEX_COLORS, getLayer } from "@/lib/archimate-helpers"
import { ArchimateNotationBadge } from "@/components/archimate-notation-badge"
import { applyDagreLayout, type GraphDirection } from "./dagre-layout"

// Nœud "bulle" en lecture seule (badge de notation + libellé), distinct du
// nœud d'édition de vue (`view-canvas-node.tsx`, redimensionnable, notation
// ArchiMate stricte) — les deux partagent la même palette de couches
// (LAYER_HEX_COLORS) et la même logique d'icône (ArchimateNotationBadge),
// voir docs/architecture.md#dashboards pour le plan de convergence.
type ArchiNodeData = {
  label: string
  layer: string
  type: string
  emphasized?: boolean
}
type ArchiNode = Node<ArchiNodeData, "archi">

function ArchiNodeComponent({ data, targetPosition, sourcePosition }: NodeProps<ArchiNode>) {
  return (
    <>
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <div style={{ position: "absolute", top: -13, right: -4 }}>
        <ArchimateNotationBadge elementType={data.type} size={18} />
      </div>
      <span>{data.label}</span>
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </>
  )
}

const NODE_TYPES: NodeTypes = { archi: ArchiNodeComponent }

const HANDLE_POSITIONS: Record<GraphDirection, { target: Position; source: Position }> = {
  LR: { target: Position.Left, source: Position.Right },
  TB: { target: Position.Top, source: Position.Bottom },
}

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
  direction = "LR",
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

  const computedNodes = useMemo<ArchiNode[]>(() => {
    const { target, source } = HANDLE_POSITIONS[direction]
    const laidOut = applyDagreLayout(
      inputNodes.map((n) => ({ id: n.id, label: n.label, rankGroup: n.rankGroup })),
      inputEdges,
      direction
    )
    const positionById = new Map(laidOut.map((n) => [n.id, { x: n.x, y: n.y }]))
    return inputNodes.map((n) => {
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
          borderRadius: 4,
          padding: "6px 10px",
          fontSize: 11,
          width: "auto",
          maxWidth: 220,
          opacity: n.dimmed ? 0.35 : 1,
        },
      }
    })
  }, [inputNodes, inputEdges, direction])

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes)
  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes])

  const edges = useMemo<Edge[]>(
    () =>
      inputEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.type,
        labelStyle: { fontSize: 10, opacity: e.dimmed ? 0.35 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1.5, opacity: e.dimmed ? 0.35 : 1 },
      })),
    [inputEdges]
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
    <div style={{ height }} className={cn("overflow-hidden rounded-lg border border-border")}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeClick={nodeHref ? (_, node) => router.push(nodeHref(node.id)) : undefined}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        {panel ? <Panel position="top-left">{panel}</Panel> : null}
      </ReactFlow>
    </div>
  )
}
