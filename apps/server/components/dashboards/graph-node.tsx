import {
  Handle,
  Position,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import { ArchimateLayerBadge } from "@/components/archimate-layer-badge"
import { ArchimateNotationBadge } from "@/components/archimate-notation-badge"
import type { GraphDirection } from "./dagre-layout"

type ArchiNodeData = {
  label: string
  layer: string
  type: string
  emphasized?: boolean
}

export type DashboardArchiNode = Node<ArchiNodeData, "archi">

function DashboardArchiNodeComponent({
  data,
  targetPosition,
  sourcePosition,
}: NodeProps<DashboardArchiNode>) {
  return (
    <>
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <div style={{ position: "absolute", top: -13, right: -4 }}>
        <ArchimateNotationBadge elementType={data.type} size={18} />
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 6,
          transform: "translateY(-50%)",
        }}
      >
        <ArchimateLayerBadge layer={data.layer} />
      </div>
      <span
        title={data.label}
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          lineHeight: 1.25,
        }}
      >
        {data.label}
      </span>
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </>
  )
}

export const DASHBOARD_NODE_TYPES: NodeTypes = {
  archi: DashboardArchiNodeComponent,
}

export const DASHBOARD_HANDLE_POSITIONS: Record<
  GraphDirection,
  { target: Position; source: Position }
> = {
  LR: { target: Position.Left, source: Position.Right },
  TB: { target: Position.Top, source: Position.Bottom },
}
