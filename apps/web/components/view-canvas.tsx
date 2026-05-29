"use client";

import { useEffect, useMemo } from "react";
import type React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  Panel,
  Position,
  getNodesBounds,
  getSmoothStepPath,
  getViewportForBounds,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";
import type { NodeOut, ConnectionOut } from "@/lib/api";

const HANDLE_STYLE: React.CSSProperties = {
  width: 6,
  height: 6,
  background: "#fff",
  border: "1px solid #555",
  borderRadius: "50%",
  pointerEvents: "none",
  opacity: 0.85,
};

const ARCHIMATE_LAYER: Record<string, string> = {
  Resource: "strategy", Capability: "strategy", ValueStream: "strategy", CourseOfAction: "strategy",
  BusinessActor: "business", BusinessRole: "business", BusinessCollaboration: "business",
  BusinessInterface: "business", BusinessProcess: "business", BusinessFunction: "business",
  BusinessInteraction: "business", BusinessEvent: "business", BusinessService: "business",
  BusinessObject: "business", Contract: "business", Representation: "business", Product: "business",
  ApplicationComponent: "application", ApplicationCollaboration: "application",
  ApplicationInterface: "application", ApplicationFunction: "application",
  ApplicationInteraction: "application", ApplicationProcess: "application",
  ApplicationEvent: "application", ApplicationService: "application", DataObject: "application",
  Node: "technology", Device: "technology", SystemSoftware: "technology",
  TechnologyCollaboration: "technology", TechnologyInterface: "technology", Path: "technology",
  CommunicationNetwork: "technology", TechnologyFunction: "technology",
  TechnologyProcess: "technology", TechnologyInteraction: "technology",
  TechnologyEvent: "technology", TechnologyService: "technology", Artifact: "technology",
  Equipment: "physical", Facility: "physical", DistributionNetwork: "physical", Material: "physical",
  Stakeholder: "motivation", Driver: "motivation", Assessment: "motivation", Goal: "motivation",
  Outcome: "motivation", Principle: "motivation", Requirement: "motivation",
  Constraint: "motivation", Meaning: "motivation", Value: "motivation",
  WorkPackage: "implementation", Deliverable: "implementation",
  ImplementationEvent: "implementation", Plateau: "implementation", Gap: "implementation",
  Grouping: "other", Location: "other", Junction: "junction", AndJunction: "junction", OrJunction: "junction",
};

const LAYER_COLOR: Record<string, { bg: string; border: string }> = {
  strategy: { bg: "#F5DEB3", border: "#B8860B" },
  business: { bg: "#FFFFB5", border: "#A9A93C" },
  application: { bg: "#B5FFFF", border: "#3C9999" },
  technology: { bg: "#C5E0B4", border: "#4F8B3A" },
  physical: { bg: "#C5E0B4", border: "#4F8B3A" },
  motivation: { bg: "#CCCCFF", border: "#6B6BCC" },
  implementation: { bg: "#FFE0E0", border: "#CC6B6B" },
  other: { bg: "#FFFFFF", border: "#b1b1b7" },
  junction: { bg: "#000000", border: "#000000" },
};

function colorFor(elementType?: string): { bg: string; border: string } {
  const layer = elementType ? ARCHIMATE_LAYER[elementType] : undefined;
  return LAYER_COLOR[layer ?? "other"] ?? LAYER_COLOR.other;
}

function ArchiNode({ data, selected }: NodeProps) {
  const elementType = (data.elementType as string | undefined) ?? undefined;
  const hasChildren = Boolean(data.hasChildren);
  const { bg, border } = colorFor(elementType);
  const containerStyle: React.CSSProperties = hasChildren
    ? {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: bg,
        padding: "16px 6px 6px 6px",
        fontSize: 11,
        textAlign: "left",
        overflow: "hidden",
        cursor: "grab",
        position: "relative",
      }
    : {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        fontSize: 11,
        textAlign: "center",
        overflow: "hidden",
        cursor: "grab",
      };
  return (
    <div style={containerStyle}>
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={30}
        lineStyle={{ borderColor: "#3b82f6" }}
        handleStyle={{ width: 8, height: 8, background: "#fff", border: "1px solid #3b82f6", borderRadius: 2 }}
      />
      <Handle type="source" position={Position.Top} id="s-top" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="s-right" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="s-left" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Top} id="t-top" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="t-right" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="t-left" style={HANDLE_STYLE} />
      {hasChildren ? (
        <span style={{ position: "absolute", top: 3, left: 6, fontWeight: 500, pointerEvents: "none" }}>
          {String(data.label ?? "")}
        </span>
      ) : (
        <span>{String(data.label ?? "")}</span>
      )}
    </div>
  );
}

interface ArchiEdgeStyle {
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

function archimateEdgeStyle(type?: string): ArchiEdgeStyle {
  switch (type) {
    case "Composition":
      return { markerStart: "url(#archi-diamond-filled)" };
    case "Aggregation":
      return { markerStart: "url(#archi-diamond-open)" };
    case "Assignment":
      return { markerStart: "url(#archi-dot-filled)", markerEnd: "url(#archi-arrow-filled)" };
    case "Realization":
      return { markerEnd: "url(#archi-triangle-open)", strokeDasharray: "6 3" };
    case "Serving":
    case "UsedBy":
      return { markerEnd: "url(#archi-arrow-open)" };
    case "Triggering":
      return { markerEnd: "url(#archi-arrow-filled)" };
    case "Flow":
      return { markerEnd: "url(#archi-arrow-filled)", strokeDasharray: "6 3" };
    case "Access":
      return { markerEnd: "url(#archi-arrow-open)", strokeDasharray: "1 4" };
    case "Influence":
      return { markerEnd: "url(#archi-arrow-open)", strokeDasharray: "6 3" };
    case "Specialization":
      return { markerEnd: "url(#archi-triangle-open)" };
    case "Association":
    default:
      return {};
  }
}

function ArchiEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const relType = (data?.relationshipType as string | undefined) ?? undefined;
  const archi = archimateEdgeStyle(relType);
  const strokeStyle: React.CSSProperties = {
    stroke: "#222",
    strokeWidth: 1.2,
    fill: "none",
    ...(archi.strokeDasharray ? { strokeDasharray: archi.strokeDasharray } : {}),
  };
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={strokeStyle}
        markerStart={archi.markerStart}
        markerEnd={archi.markerEnd}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#fff",
              padding: "1px 4px",
              fontSize: 10,
              border: "1px solid #ddd",
              borderRadius: 3,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = { archi: ArchiNode };
const EDGE_TYPES = { archi: ArchiEdge };

interface NodeRect { x: number; y: number; w: number; h: number }

function pickHandles(src: NodeRect, tgt: NodeRect): { sourceHandle: string; targetHandle: string } {
  const sx = src.x + src.w / 2;
  const sy = src.y + src.h / 2;
  const tx = tgt.x + tgt.w / 2;
  const ty = tgt.y + tgt.h / 2;
  const dx = tx - sx;
  const dy = ty - sy;

  let srcSide: string;
  let tgtSide: string;

  if (Math.abs(dx) >= Math.abs(dy)) {
    srcSide = dx >= 0 ? "right" : "left";
    tgtSide = dx >= 0 ? "left" : "right";
  } else {
    srcSide = dy >= 0 ? "bottom" : "top";
    tgtSide = dy >= 0 ? "top" : "bottom";
  }

  return { sourceHandle: `s-${srcSide}`, targetHandle: `t-${tgtSide}` };
}

function flattenNodes(
  nodes: NodeOut[] | null | undefined,
  elementNames: Map<string, string>,
  elementTypes: Map<string, string>,
  parentId?: string
): Node[] {
  if (!nodes) return [];
  return nodes.flatMap((n) => {
    const resolvedName =
      n.name ||
      (n.element_ref ? elementNames.get(n.element_ref) : undefined) ||
      "";
    const elementType = n.element_ref ? elementTypes.get(n.element_ref) : undefined;
    const hasChildren = Boolean(n.children && n.children.length > 0);
    const node: Node = {
      id: n.identifier,
      type: "archi",
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: { label: resolvedName, elementType, hasChildren },
      style: { width: n.w ?? undefined, height: n.h ?? undefined },
      ...(parentId ? { parentId, extent: "parent" as const, expandParent: true } : {}),
    };
    return [node, ...flattenNodes(n.children, elementNames, elementTypes, n.identifier)];
  });
}

interface ViewCanvasProps {
  nodes: NodeOut[];
  connections: ConnectionOut[];
  elementNames?: Map<string, string>;
  elementTypes?: Map<string, string>;
  relationshipTypes?: Map<string, string>;
}

const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 768;

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}

function DownloadButton({ filename = "view.png" }: { filename?: string }) {
  const { getNodes } = useReactFlow();
  const handleClick = () => {
    const nodesBounds = getNodesBounds(getNodes());
    const viewport = getViewportForBounds(nodesBounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0);
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) return;
    toPng(el, {
      backgroundColor: "#ffffff",
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      style: {
        width: `${IMAGE_WIDTH}px`,
        height: `${IMAGE_HEIGHT}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => downloadDataUrl(dataUrl, filename));
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        background: "#fff",
        border: "1px solid #b1b1b7",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Télécharger PNG
    </button>
  );
}

const MARKER_DEFS = (
  <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
    <defs>
      <marker id="archi-diamond-filled" viewBox="0 0 14 10" refX="0" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker id="archi-diamond-open" viewBox="0 0 14 10" refX="0" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker id="archi-triangle-open" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="12" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L12,5 L0,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker id="archi-arrow-filled" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker id="archi-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10" fill="none" stroke="#222" strokeWidth="1.2" />
      </marker>
      <marker id="archi-dot-filled" viewBox="0 0 8 8" refX="0" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="3.2" fill="#222" />
      </marker>
    </defs>
  </svg>
);

export function ViewCanvas({ nodes, connections, elementNames = new Map(), elementTypes = new Map(), relationshipTypes = new Map() }: ViewCanvasProps) {
  const initialNodes = useMemo(() => flattenNodes(nodes, elementNames, elementTypes), [nodes, elementNames, elementTypes]);

  const nodeRectMap = useMemo(() => {
    const map = new Map<string, NodeRect>();
    function collect(ns: NodeOut[], parentX = 0, parentY = 0) {
      for (const n of ns ?? []) {
        const x = (n.x ?? 0) + parentX;
        const y = (n.y ?? 0) + parentY;
        map.set(n.identifier, { x, y, w: n.w ?? 0, h: n.h ?? 0 });
        collect(n.children ?? [], x, y);
      }
    }
    collect(nodes);
    return map;
  }, [nodes]);

  const initialEdges = useMemo<Edge[]>(
    () =>
      connections.map((c) => {
        const src = c.source ? nodeRectMap.get(c.source) : undefined;
        const tgt = c.target ? nodeRectMap.get(c.target) : undefined;
        const handles =
          src && tgt
            ? pickHandles(src, tgt)
            : { sourceHandle: "s-bottom", targetHandle: "t-top" };
        const relType = c.relationship_ref ? relationshipTypes.get(c.relationship_ref) : undefined;
        const archiStyle = archimateEdgeStyle(relType);
        return {
          id: c.identifier,
          source: c.source ?? "",
          target: c.target ?? "",
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: "archi",
          label: c.name ?? undefined,
          animated: Boolean(archiStyle.strokeDasharray),
          data: { relationshipType: relType },
        };
      }),
    [connections, nodeRectMap, relationshipTypes]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setRfNodes(initialNodes);
  }, [initialNodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(initialEdges);
  }, [initialEdges, setRfEdges]);

  return (
    <div style={{ width: "100%", height: 600, position: "relative" }}>
      {MARKER_DEFS}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        nodesDraggable
        nodesConnectable={false}
        colorMode="system"
      >
        <Background />
        <Controls />
        <Panel position="top-right">
          <DownloadButton />
        </Panel>
      </ReactFlow>
    </div>
  );
}
