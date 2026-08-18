"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react"
import { ArchisparkReactFlow } from "@/components/archispark-react-flow"
import { ARCHIMATE_READONLY_EDGE_TYPES } from "@/components/archimate-readonly-edge"
import { NODE_TYPES } from "@/components/element-graph-node-types"
import { NODE_H, NODE_W } from "@/components/element-graph-markers"
import {
  applyDagreLayout,
  type Direction,
} from "@/components/element-graph-layout"
import { AppearancePanel } from "@/components/element-graph-appearance-panel"
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

interface RelationshipCanvasProps {
  relType: string
  relName: string | null
  isOk: boolean
  srcId: string
  srcName: string
  srcType: string
  srcImageUrl?: string | null
  tgtId: string
  tgtName: string
  tgtType: string
  tgtImageUrl?: string | null
}

function RelationshipCanvasInner({
  relType,
  relName,
  isOk,
  srcId,
  srcName,
  srcType,
  srcImageUrl,
  tgtId,
  tgtName,
  tgtType,
  tgtImageUrl,
}: RelationshipCanvasProps) {
  const router = useRouter()
  const { fitView } = useReactFlow()
  const { fullscreen, toggleFullscreen } = useReactFlowFullscreen()
  const [direction, setDirection] = useState<Direction>("LR")
  const [edgePathType, setEdgePathType] = useState<EdgePathType>("smoothstep")

  const edges = useMemo<Edge[]>(
    () => [
      {
        id: `${srcId}-${tgtId}`,
        source: srcId,
        target: tgtId,
        type: "archimate",
        label: relName ? `${relType} · ${relName}` : relType,
        data: { relationshipType: relType },
      },
    ],
    [srcId, tgtId, relType, relName]
  )

  const nodes = useMemo<Node[]>(() => {
    const rawNodes: Node[] = [
      {
        id: srcId,
        type: "archimateNode",
        position: { x: 0, y: 0 },
        style: { width: NODE_W, height: NODE_H },
        data: {
          label: srcName,
          elementType: srcType,
          isCentral: false,
          hasConflict: !isOk,
          imageUrl: srcImageUrl ?? undefined,
          onClick: () => router.push(`/elements/${encodeURIComponent(srcId)}`),
        },
      },
      {
        id: tgtId,
        type: "archimateNode",
        position: { x: 0, y: 0 },
        style: { width: NODE_W, height: NODE_H },
        data: {
          label: tgtName,
          elementType: tgtType,
          isCentral: false,
          hasConflict: !isOk,
          imageUrl: tgtImageUrl ?? undefined,
          onClick: () => router.push(`/elements/${encodeURIComponent(tgtId)}`),
        },
      },
    ]
    return applyDagreLayout(rawNodes, edges, direction)
  }, [
    srcId,
    srcName,
    srcType,
    srcImageUrl,
    tgtId,
    tgtName,
    tgtType,
    tgtImageUrl,
    isOk,
    router,
    edges,
    direction,
  ])

  function changeDirection(next: Direction) {
    setDirection(next)
    setTimeout(() => fitView({ padding: 0.35, duration: 400 }), 50)
  }

  return (
    <FullscreenContainer
      fullscreen={fullscreen}
      className="flex min-h-0 flex-1 flex-col gap-2"
    >
      <div className="relative min-h-0 flex-1" style={{ height: "100%" }}>
        <EdgeTypeContext.Provider value={edgePathType}>
          <ArchisparkReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={ARCHIMATE_READONLY_EDGE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.35 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.2}
            maxZoom={3}
            controlsProps={{ showInteractive: false }}
          >
            <CanvasToolbarPanel>
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
            </CanvasToolbarPanel>
          </ArchisparkReactFlow>
        </EdgeTypeContext.Provider>
      </div>
    </FullscreenContainer>
  )
}

/** Source → relationship → target diagram for the relationship detail page's canvas tab. */
export function RelationshipCanvas(props: RelationshipCanvasProps) {
  return (
    <ReactFlowProvider>
      <RelationshipCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
