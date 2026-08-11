"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { type Edge, type Node } from "@xyflow/react"
import { ArchisparkReactFlow } from "@/components/archispark-react-flow"
import { ARCHIMATE_READONLY_EDGE_TYPES } from "@/components/archimate-readonly-edge"
import { NODE_TYPES } from "@/components/element-graph-node-types"
import { NODE_H, NODE_W } from "@/components/element-graph-markers"

const NODE_GAP = 140

/** Source → relationship → target diagram for the relationship detail page's canvas tab. */
export function RelationshipCanvas({
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
}: {
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
}) {
  const router = useRouter()

  const nodes = useMemo<Node[]>(
    () => [
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
        position: { x: NODE_W + NODE_GAP, y: 0 },
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
    ],
    [
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
    ]
  )

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

  return (
    <div className="flex flex-1">
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
      />
    </div>
  )
}
