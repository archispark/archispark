"use client";

import { useEffect, useRef } from "react";
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
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers";
import type { ElementOut, RelationshipOut } from "@/lib/api";
import { useRouter } from "next/navigation";

const NODE_W = 150;
const NODE_H = 60;

interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  elementType: string;
  isCentral: boolean;
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
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
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
        <div
          style={{
            fontSize: 10,
            color,
            fontWeight: 700,
            letterSpacing: 0.4,
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
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
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </>
  );
}

const NODE_TYPES = { archimateNode: ArchiNode };

export interface ElementGraphTabProps {
  element: ElementOut;
  relationships: RelationshipOut[];
  byId: Map<string, ElementOut>;
}

function GraphCanvas({ element, relationships, byId }: ElementGraphTabProps) {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const simRef = useRef<Simulation<SimNode, SimulationLinkDatum<SimNode>> | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    simRef.current?.stop();
    simRef.current = null;
    fittedRef.current = false;

    // Central node — fixed at origin
    const nodeMap = new Map<string, SimNode>();
    nodeMap.set(element.identifier, {
      id: element.identifier,
      label: element.name,
      elementType: element.type,
      isCentral: true,
      fx: 0,
      fy: 0,
    });

    // Collect unique neighbor ids
    const neighborIds = new Set<string>();
    for (const rel of relationships) {
      const otherId =
        rel.source === element.identifier ? rel.target : rel.source;
      neighborIds.add(otherId);
    }

    // Place neighbors in a circle initially
    let idx = 0;
    for (const otherId of neighborIds) {
      const other = byId.get(otherId);
      const rel = relationships.find(
        (r) => r.source === otherId || r.target === otherId,
      );
      const label =
        other?.name ??
        (rel
          ? rel.source === element.identifier
            ? (rel.target_name ?? otherId)
            : (rel.source_name ?? otherId)
          : otherId);
      const angle = (idx / Math.max(neighborIds.size, 1)) * 2 * Math.PI;
      nodeMap.set(otherId, {
        id: otherId,
        label,
        elementType: other?.type ?? "Grouping",
        isCentral: false,
        x: Math.cos(angle) * 230,
        y: Math.sin(angle) * 230,
      });
      idx++;
    }

    const simNodes = Array.from(nodeMap.values());

    // Valid edges (both endpoints present)
    const validRels = relationships.filter(
      (r) => nodeMap.has(r.source) && nodeMap.has(r.target),
    );

    setEdges(
      validRels.map((r) => ({
        id: r.identifier,
        source: r.source,
        target: r.target,
        label: r.name || r.type,
        labelStyle: { fontSize: 9, fill: "#64748b" },
        labelBgStyle: { fill: "rgba(255,255,255,0.85)" },
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        type: "smoothstep",
        animated: true,
      })) as Edge[],
    );

    const links = validRels.map((r) => ({
      source: r.source,
      target: r.target,
    })) as SimulationLinkDatum<SimNode>[];

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
          .id((d) => d.id)
          .distance(230)
          .strength(0.5),
      )
      .force("charge", forceManyBody<SimNode>().strength(-520))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<SimNode>(NODE_W * 0.7))
      .alphaDecay(0.025)
      .on("tick", () => {
        setNodes(
          simNodes.map((n) => ({
            id: n.id,
            position: {
              x: (n.x ?? 0) - NODE_W / 2,
              y: (n.y ?? 0) - NODE_H / 2,
            },
            data: {
              label: n.label,
              elementType: n.elementType,
              isCentral: n.isCentral,
              onClick: n.isCentral
                ? undefined
                : () =>
                    router.push(
                      `/elements/${encodeURIComponent(n.id)}`,
                    ),
            },
            type: "archimateNode",
          })),
        );
        // Fit view once after the first tick so nodes are visible
        if (!fittedRef.current) {
          fittedRef.current = true;
          setTimeout(() => fitView({ padding: 0.35, duration: 700 }), 80);
        }
      });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [element, relationships, byId, router, setNodes, setEdges, fitView]);

  return (
    <div
      style={{ width: "100%", height: 500 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.2}
        maxZoom={3}
      >
        <Background color="#e2e8f0" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
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
