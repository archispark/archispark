"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
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
import { AppearancePanel } from "@/components/element-graph-appearance-panel"
import { FilterPanel } from "@/components/element-graph-filter-panel"
import {
  ReactFlowFullscreenButton,
  useReactFlowFullscreen,
} from "@/components/react-flow-fullscreen"

// ── Public props ──────────────────────────────────────────────────────────────

export interface ElementGraphTabProps {
  element: ElementOut
  allRelationships: RelationshipOut[]
  byId: Map<string, ElementOut>
}

const GRAPH_DEPTH = 1

// ── Canvas ────────────────────────────────────────────────────────────────────

function GraphCanvas({
  element,
  allRelationships,
  byId,
}: ElementGraphTabProps) {
  const router = useRouter()
  const { fitView } = useReactFlow()
  const { fullscreen, toggleFullscreen } = useReactFlowFullscreen()
  const [direction, setDirection] = useState<Direction>("TB")
  const [edgePathType, setEdgePathType] = useState<EdgePathType>("smoothstep")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [hiddenElementTypes, setHiddenElementTypes] = useState<Set<string>>(
    new Set()
  )
  const [hiddenRelTypes, setHiddenRelTypes] = useState<Set<string>>(new Set())
  const hiddenElRef = useRef<Set<string>>(new Set())
  const hiddenRelRef = useRef<Set<string>>(new Set())
  const { availableElementTypes, availableRelTypes } = useMemo(() => {
    const { elementTypes, relTypes } = getReachableTypes(
      element,
      allRelationships,
      byId,
      GRAPH_DEPTH
    )
    return { availableElementTypes: elementTypes, availableRelTypes: relTypes }
  }, [element, allRelationships, byId])

  const layout = useCallback(
    (dir: Direction, hiddenEl: Set<string>, hiddenRel: Set<string>) => {
      const { nodes: rawNodes, edges: rawEdges } = buildGraph(
        element,
        allRelationships,
        byId,
        GRAPH_DEPTH,
        hiddenEl,
        hiddenRel,
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
    layout(direction, hiddenElRef.current, hiddenRelRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, allRelationships, byId])

  function changeDirection(next: Direction) {
    setDirection(next)
    layout(next, hiddenElRef.current, hiddenRelRef.current)
  }

  function changeElementTypes(hidden: Set<string>) {
    hiddenElRef.current = hidden
    setHiddenElementTypes(hidden)
    layout(direction, hidden, hiddenRelRef.current)
  }

  function changeRelTypes(hidden: Set<string>) {
    hiddenRelRef.current = hidden
    setHiddenRelTypes(hidden)
    layout(direction, hiddenElRef.current, hidden)
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[60] flex min-h-0 flex-col gap-2 bg-background p-4"
          : "flex min-h-0 flex-1 flex-col gap-2"
      }
    >
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
            <Background />
            <Panel position="top-right">
              <div className="flex flex-col items-end gap-1">
                <FilterPanel
                  availableElementTypes={availableElementTypes}
                  availableRelTypes={availableRelTypes}
                  hiddenElementTypes={hiddenElementTypes}
                  hiddenRelTypes={hiddenRelTypes}
                  onChangeElementTypes={changeElementTypes}
                  onChangeRelTypes={changeRelTypes}
                />
                <AppearancePanel
                  edgePathType={edgePathType}
                  onChangeEdgePathType={setEdgePathType}
                  direction={direction}
                  onChangeDirection={changeDirection}
                />
                <ReactFlowFullscreenButton
                  fullscreen={fullscreen}
                  onToggle={toggleFullscreen}
                />
              </div>
            </Panel>
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
