"use client"

import { useEffect, useMemo } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { type NodeOut, type ConnectionOut, type ElementOut } from "@/lib/api"
import { ViewIdContext } from "@/components/view-canvas-context"
import { ArchiNode } from "@/components/view-canvas-node"
import { ArchiEdge, archimateEdgeStyle } from "@/components/view-canvas-edge"
import {
  type NodeRect,
  pickHandles,
  flattenNodes,
  HIDDEN_ELEMENT_TYPES,
} from "@/components/view-canvas-builder"
import { ElementPalette } from "@/components/view-canvas-palette"
import { DownloadMenu } from "@/components/view-canvas-download-menu"
import { HANDLE_HOVER_CSS, MARKER_DEFS } from "@/components/view-canvas-markers"
import { PendingConnectionDialog } from "@/components/view-canvas-pending-connection-dialog"
import { useViewCanvasHandlers } from "@/components/use-view-canvas-handlers"

const NODE_TYPES = { archi: ArchiNode }
const EDGE_TYPES = { archi: ArchiEdge }

interface ViewCanvasProps {
  viewId?: string
  nodes: NodeOut[]
  connections: ConnectionOut[]
  elements?: ElementOut[]
  elementNames?: Map<string, string>
  elementTypes?: Map<string, string>
  relationshipTypes?: Map<string, string>
  relationshipNames?: Map<string, string>
}

export function ViewCanvas(props: ViewCanvasProps) {
  return (
    <ReactFlowProvider>
      <ViewCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function ViewCanvasInner({
  viewId,
  nodes,
  connections,
  elements = [],
  elementNames = new Map(),
  elementTypes = new Map(),
  relationshipTypes = new Map(),
  relationshipNames = new Map(),
}: ViewCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const initialNodes = useMemo(
    () => flattenNodes(nodes, elementNames, elementTypes),
    [nodes, elementNames, elementTypes]
  )

  const nodeRectMap = useMemo(() => {
    const map = new Map<string, NodeRect>()
    // Model coordinates are already absolute (from the diagram top-left), so
    // children are stored at their final position — no parent offset to add.
    function collect(ns: NodeOut[]) {
      for (const n of ns ?? []) {
        map.set(n.identifier, {
          x: n.x ?? 0,
          y: n.y ?? 0,
          w: n.w ?? 0,
          h: n.h ?? 0,
        })
        collect(n.children ?? [])
      }
    }
    collect(nodes)
    return map
  }, [nodes])

  // IDs of hidden nodes — edges connected to them are also filtered out.
  const hiddenNodeIds = useMemo(() => {
    const ids = new Set<string>()
    function collect(ns: NodeOut[]) {
      for (const n of ns ?? []) {
        const t = n.element_ref ? elementTypes.get(n.element_ref) : undefined
        if (t && HIDDEN_ELEMENT_TYPES.has(t)) ids.add(n.identifier)
        collect(n.children ?? [])
      }
    }
    collect(nodes)
    return ids
  }, [nodes, elementTypes])

  const initialEdges = useMemo<Edge[]>(
    () =>
      connections
        .filter(
          (c) =>
            !hiddenNodeIds.has(c.source ?? "") &&
            !hiddenNodeIds.has(c.target ?? "")
        )
        .map((c) => {
          const src = c.source ? nodeRectMap.get(c.source) : undefined
          const tgt = c.target ? nodeRectMap.get(c.target) : undefined
          const handles =
            src && tgt
              ? pickHandles(src, tgt)
              : { sourceHandle: "s-bottom", targetHandle: "t-top" }
          const relType = c.relationship_ref
            ? relationshipTypes.get(c.relationship_ref)
            : undefined
          const relName = c.relationship_ref
            ? relationshipNames.get(c.relationship_ref)
            : undefined
          const archiStyle = archimateEdgeStyle(relType)
          const label = c.name || relName || undefined
          const sourceHandle = c.source_side
            ? `s-${c.source_side}`
            : handles.sourceHandle
          const targetHandle = c.target_side
            ? `t-${c.target_side}`
            : handles.targetHandle
          return {
            id: c.identifier,
            source: c.source ?? "",
            target: c.target ?? "",
            sourceHandle,
            targetHandle,
            type: "archi",
            label,
            animated: Boolean(archiStyle.strokeDasharray),
            reconnectable: true,
            data: {
              relationshipType: relType,
              relationshipRef: c.relationship_ref ?? null,
            },
          }
        }),
    [
      connections,
      nodeRectMap,
      relationshipTypes,
      relationshipNames,
      hiddenNodeIds,
    ]
  )

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges)

  const {
    onDragOver,
    onDrop,
    onReconnect,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    onConnect,
    confirmRelationshipType,
    onEdgeDoubleClick,
    onNodeDoubleClick,
    pendingConnection,
    setPendingConnection,
  } = useViewCanvasHandlers({
    viewId,
    elementTypes,
    elementNames,
    rfNodes,
    setRfNodes,
    setRfEdges,
    screenToFlowPosition,
  })

  useEffect(() => {
    setRfNodes(initialNodes)
  }, [initialNodes, setRfNodes])

  useEffect(() => {
    setRfEdges(initialEdges)
  }, [initialEdges, setRfEdges])

  return (
    <ViewIdContext.Provider value={viewId}>
      <div
        style={{
          width: "100%",
          height: 600,
          position: "relative",
          display: "flex",
        }}
      >
        {viewId ? <ElementPalette elements={elements} /> : null}
        <div
          style={{ flex: 1, position: "relative" }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {HANDLE_HOVER_CSS}
          {MARKER_DEFS}
          {pendingConnection ? (
            <PendingConnectionDialog
              pendingConnection={pendingConnection}
              onCancel={() => setPendingConnection(null)}
              onConfirmType={confirmRelationshipType}
            />
          ) : null}
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            fitView
            nodesDraggable
            nodesConnectable
            deleteKeyCode={["Backspace", "Delete"]}
            colorMode="system"
          >
            <Background />
            <Controls />
            <Panel position="top-right">
              <DownloadMenu />
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </ViewIdContext.Provider>
  )
}
