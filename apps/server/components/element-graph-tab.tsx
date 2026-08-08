"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { ElementOut, RelationshipOut } from "@/lib/api"
import { useRouter } from "next/navigation"
import {
  MARKER_DEFS,
  EdgeTypeContext,
  type EdgePathType,
} from "@/components/element-graph-markers"
import { NODE_TYPES, EDGE_TYPES } from "@/components/element-graph-node-types"
import {
  applyDagreLayout,
  type Direction,
} from "@/components/element-graph-layout"
import {
  buildGraph,
  getReachableTypes,
} from "@/components/element-graph-builder"
import { GraphToolbar } from "@/components/element-graph-toolbar"

// ── Public props ──────────────────────────────────────────────────────────────

export interface ElementGraphTabProps {
  element: ElementOut
  allRelationships: RelationshipOut[]
  byId: Map<string, ElementOut>
}

// ── Canvas ────────────────────────────────────────────────────────────────────

function GraphCanvas({
  element,
  allRelationships,
  byId,
}: ElementGraphTabProps) {
  const router = useRouter()
  const { fitView } = useReactFlow()
  const [direction, setDirection] = useState<Direction>("TB")
  const [depth, setDepth] = useState(1)
  const [showIndirect, setShowIndirect] = useState(false)
  const [edgePathType, setEdgePathType] = useState<EdgePathType>("smoothstep")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [hiddenElementTypes, setHiddenElementTypes] = useState<Set<string>>(
    new Set()
  )
  const [hiddenRelTypes, setHiddenRelTypes] = useState<Set<string>>(new Set())
  const hiddenElRef = useRef<Set<string>>(new Set())
  const hiddenRelRef = useRef<Set<string>>(new Set())

  const [availableElementTypes, setAvailableElementTypes] = useState<string[]>(
    []
  )
  const [availableRelTypes, setAvailableRelTypes] = useState<string[]>([])

  const layout = useCallback(
    (
      dir: Direction,
      d: number,
      hiddenEl: Set<string>,
      hiddenRel: Set<string>,
      indirect: boolean
    ) => {
      const { nodes: rawNodes, edges: rawEdges } = buildGraph(
        element,
        allRelationships,
        byId,
        d,
        hiddenEl,
        hiddenRel,
        indirect,
        router
      )
      const laid = applyDagreLayout(rawNodes, rawEdges, dir)
      setNodes(laid)
      setEdges(rawEdges)
      setTimeout(() => fitView({ padding: 0.35, duration: 400 }), 50)
    },
    [element, allRelationships, byId, router, setNodes, setEdges, fitView]
  )

  useEffect(() => {
    const { elementTypes, relTypes } = getReachableTypes(
      element,
      allRelationships,
      byId,
      depth
    )
    setAvailableElementTypes(elementTypes)
    setAvailableRelTypes(relTypes)
    layout(
      direction,
      depth,
      hiddenElRef.current,
      hiddenRelRef.current,
      showIndirect
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, allRelationships, byId, depth, showIndirect])

  function toggleDirection() {
    const next: Direction = direction === "TB" ? "LR" : "TB"
    setDirection(next)
    layout(next, depth, hiddenElRef.current, hiddenRelRef.current, showIndirect)
  }

  function changeElementTypes(hidden: Set<string>) {
    hiddenElRef.current = hidden
    setHiddenElementTypes(hidden)
    layout(direction, depth, hidden, hiddenRelRef.current, showIndirect)
  }

  function changeRelTypes(hidden: Set<string>) {
    hiddenRelRef.current = hidden
    setHiddenRelTypes(hidden)
    layout(direction, depth, hiddenElRef.current, hidden, showIndirect)
  }

  function changeShowIndirect(indirect: boolean) {
    setShowIndirect(indirect)
    layout(
      direction,
      depth,
      hiddenElRef.current,
      hiddenRelRef.current,
      indirect
    )
  }

  function changeDepth(d: number) {
    setDepth(d)
    if (d > 1 && !showIndirect) {
      setShowIndirect(true)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <GraphToolbar
        availableElementTypes={availableElementTypes}
        availableRelTypes={availableRelTypes}
        hiddenElementTypes={hiddenElementTypes}
        hiddenRelTypes={hiddenRelTypes}
        onChangeElementTypes={changeElementTypes}
        onChangeRelTypes={changeRelTypes}
        depth={depth}
        onChangeDepth={changeDepth}
        showIndirect={showIndirect}
        onChangeShowIndirect={changeShowIndirect}
        edgePathType={edgePathType}
        onChangeEdgePathType={setEdgePathType}
        direction={direction}
        onToggleDirection={toggleDirection}
      />

      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
        style={{ height: "100%" }}
      >
        {MARKER_DEFS}
        <EdgeTypeContext.Provider value={edgePathType}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.2}
            maxZoom={3}
          >
            <Background color="#e2e8f0" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </EdgeTypeContext.Provider>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export function ElementGraphTab(props: ElementGraphTabProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}
