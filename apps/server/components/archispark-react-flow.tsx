"use client"

import type { ComponentProps, ReactNode } from "react"
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ARCHIMATE_EDGE_MARKERS } from "@/components/archimate-edge-markers"

type SharedReactFlowProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = ReactFlowProps<NodeType, EdgeType> & {
  children?: ReactNode
  controlsProps?: ComponentProps<typeof Controls>
}

/**
 * Unique React Flow shell for ArchiSpark. Business-specific nodes, edges,
 * panels and handlers stay with their feature; canvas chrome lives here.
 */
export function ArchisparkReactFlow<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>({
  children,
  controlsProps,
  proOptions,
  ...props
}: SharedReactFlowProps<NodeType, EdgeType>) {
  return (
    <ReactFlow {...props} proOptions={{ hideAttribution: true, ...proOptions }}>
      {ARCHIMATE_EDGE_MARKERS}
      <Background />
      <Controls {...controlsProps} />
      {children}
    </ReactFlow>
  )
}
