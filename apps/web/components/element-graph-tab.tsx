"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers";
import type { ElementOut, RelationshipOut } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";

const NODE_W = 150;
const NODE_H = 60;

type Direction = "TB" | "LR";

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: Direction,
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return { ...node, position: { x: x - NODE_W / 2, y: y - NODE_H / 2 } };
  });
}

function ArchiNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    elementType: string;
    isCentral: boolean;
    onClick?: () => void;
  };
  const layer = getLayer(d.elementType);
  const color = LAYER_HEX_COLORS[layer] ?? "#64748b";

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        onClick={d.onClick}
        style={{
          width: NODE_W,
          height: NODE_H,
          border: `${d.isCentral ? 3 : 1.5}px solid ${color}`,
          borderRadius: 8,
          background: d.isCentral ? `${color}22` : "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 10px",
          cursor: d.isCentral ? "default" : "pointer",
          boxShadow: d.isCentral
            ? `0 0 0 4px ${color}33, 0 2px 10px rgba(0,0,0,0.12)`
            : "0 1px 4px rgba(0,0,0,0.08)",
          textAlign: "center",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 0.4, lineHeight: 1, marginBottom: 4 }}>
          {d.elementType}
        </div>
        <div
          style={{
            fontSize: d.isCentral ? 13 : 12,
            fontWeight: d.isCentral ? 700 : 500,
            color: "#1e293b",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {d.label || "—"}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
    </>
  );
}

const NODE_TYPES = { archimateNode: ArchiNode };

export interface ElementGraphTabProps {
  element: ElementOut;
  relationships: RelationshipOut[];
  byId: Map<string, ElementOut>;
}

function buildGraph(
  element: ElementOut,
  relationships: RelationshipOut[],
  byId: Map<string, ElementOut>,
  router: ReturnType<typeof useRouter>,
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>();

  const addNode = (id: string, label: string, elementType: string, isCentral: boolean) => {
    if (nodeMap.has(id)) return;
    nodeMap.set(id, {
      id,
      position: { x: 0, y: 0 },
      data: {
        label,
        elementType,
        isCentral,
        onClick: isCentral ? undefined : () => router.push(`/elements/${encodeURIComponent(id)}`),
      },
      type: "archimateNode",
    });
  };

  addNode(element.identifier, element.name, element.type, true);

  const validRels: RelationshipOut[] = [];
  for (const rel of relationships) {
    const otherId = rel.source === element.identifier ? rel.target : rel.source;
    const other = byId.get(otherId);
    const label =
      other?.name ??
      (rel.source === element.identifier ? (rel.target_name ?? otherId) : (rel.source_name ?? otherId));
    addNode(otherId, label, other?.type ?? "Grouping", false);
    validRels.push(rel);
  }

  const edges: Edge[] = validRels
    .filter((r) => nodeMap.has(r.source) && nodeMap.has(r.target))
    .map((r) => ({
      id: r.identifier,
      source: r.source,
      target: r.target,
      label: r.name || r.type,
      labelStyle: { fontSize: 9, fill: "#64748b" },
      labelBgStyle: { fill: "rgba(255,255,255,0.85)" },
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      type: "smoothstep",
    }));

  return { nodes: Array.from(nodeMap.values()), edges };
}

function GraphCanvas({ element, relationships, byId }: ElementGraphTabProps) {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const [direction, setDirection] = useState<Direction>("TB");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const layout = useCallback(
    (dir: Direction) => {
      const { nodes: rawNodes, edges: rawEdges } = buildGraph(element, relationships, byId, router);
      const laid = applyDagreLayout(rawNodes, rawEdges, dir);
      setNodes(laid);
      setEdges(rawEdges);
      setTimeout(() => fitView({ padding: 0.35, duration: 400 }), 50);
    },
    [element, relationships, byId, router, setNodes, setEdges, fitView],
  );

  useEffect(() => {
    layout(direction);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, relationships, byId]);

  function toggleDirection() {
    const next: Direction = direction === "TB" ? "LR" : "TB";
    setDirection(next);
    layout(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={toggleDirection}>
          {direction === "TB" ? "→ Horizontal" : "↓ Vertical"}
        </Button>
      </div>
      <div style={{ width: "100%", height: 500 }} className="rounded-lg border border-border overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.2}
          maxZoom={3}
        >
          <Background color="#e2e8f0" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function ElementGraphTab(props: ElementGraphTabProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
