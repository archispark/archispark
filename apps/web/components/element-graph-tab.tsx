"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers";
import type { ElementOut, RelationshipOut } from "@/lib/api";
import { isRelationshipAllowed } from "@/lib/archimate-rules";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { SlidersHorizontal } from "lucide-react";

const NODE_W = 150;
const NODE_H = 60;

type Direction = "TB" | "LR";
type EdgePathType = "smoothstep" | "bezier" | "step" | "straight";

function getStepPath({ sourceX, sourceY, targetX, targetY }: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}): [string, number, number] {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  return [`M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`, midX, midY];
}

const EdgeTypeContext = createContext<EdgePathType>("smoothstep");

// ── Layout ────────────────────────────────────────────────────────────────────

function applyDagreLayout(nodes: Node[], edges: Edge[], direction: Direction): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  for (const node of nodes) g.setNode(node.id, { width: NODE_W, height: NODE_H });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  dagre.layout(g);
  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return { ...node, position: { x: x - NODE_W / 2, y: y - NODE_H / 2 } };
  });
}

// ── ArchiMate edge markers ────────────────────────────────────────────────────

interface ArchiEdgeStyle {
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

function archimateEdgeStyle(type?: string): ArchiEdgeStyle {
  switch (type) {
    case "Composition":
      return { markerStart: "url(#eg-diamond-filled)" };
    case "Aggregation":
      return { markerStart: "url(#eg-diamond-open)" };
    case "Assignment":
      return { markerStart: "url(#eg-dot-filled)", markerEnd: "url(#eg-arrow-open)" };
    case "Realization":
      return { markerEnd: "url(#eg-triangle-open)", strokeDasharray: "6 3" };
    case "Serving":
    case "UsedBy":
      return { markerEnd: "url(#eg-arrow-open)" };
    case "Triggering":
      return { markerEnd: "url(#eg-arrow-filled)" };
    case "Flow":
      return { markerEnd: "url(#eg-arrow-filled)", strokeDasharray: "6 3" };
    case "Access":
      return { markerEnd: "url(#eg-arrow-open)", strokeDasharray: "4 3" };
    case "Influence":
      return { markerEnd: "url(#eg-arrow-open)", strokeDasharray: "6 3" };
    case "Specialization":
      return { markerEnd: "url(#eg-triangle-open)" };
    case "Association":
    default:
      return {};
  }
}

// Marker SVG defs — must be in the DOM for url(#…) references to resolve.
// IDs are prefixed with "eg-" to avoid collisions with view-canvas markers.
const MARKER_DEFS = (
  <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
    <defs>
      <marker id="eg-diamond-filled" viewBox="0 0 14 10" refX="0" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker id="eg-diamond-open" viewBox="0 0 14 10" refX="0" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker id="eg-triangle-open" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="12" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L12,5 L0,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker id="eg-arrow-filled" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker id="eg-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10" fill="none" stroke="#222" strokeWidth="1.2" />
      </marker>
      <marker id="eg-dot-filled" viewBox="0 0 16 16" refX="9" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <circle cx="7" cy="8" r="7" fill="#000" stroke="#fff" strokeWidth="1.5" />
      </marker>
    </defs>
  </svg>
);

// ── Custom edge ───────────────────────────────────────────────────────────────

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
  const edgePathType = useContext(EdgeTypeContext);
  const pathArgs = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path, labelX, labelY] =
    edgePathType === "bezier"   ? getBezierPath(pathArgs) :
    edgePathType === "straight" ? getStraightPath({ sourceX, sourceY, targetX, targetY }) :
    edgePathType === "step"     ? getStepPath({ sourceX, sourceY, targetX, targetY }) :
                                  getSmoothStepPath(pathArgs);
  const relType = (data?.relationshipType as string | undefined) ?? undefined;
  const archi = archimateEdgeStyle(relType);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: "#222",
          strokeWidth: 1.2,
          fill: "none",
          ...(archi.strokeDasharray ? { strokeDasharray: archi.strokeDasharray } : {}),
        }}
        markerStart={archi.markerStart}
        markerEnd={archi.markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            <span
              style={{
                background: "#fff",
                padding: "1px 5px",
                fontSize: 9,
                border: "1px solid #ddd",
                borderRadius: 3,
                color: "#475569",
                whiteSpace: "nowrap",
              }}
            >
              {label as string}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ── Node renderer ─────────────────────────────────────────────────────────────

function ArchiNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    elementType: string;
    isCentral: boolean;
    hasConflict: boolean;
    onClick?: () => void;
  };
  const layer = getLayer(d.elementType);
  const color = LAYER_HEX_COLORS[layer] ?? "#64748b";
  const borderColor = d.hasConflict ? "#dc2626" : color;
  const borderWidth = d.isCentral ? 3 : 1.5;
  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        onClick={d.onClick}
        style={{
          width: NODE_W,
          height: NODE_H,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 8,
          background: d.isCentral ? `${color}22` : (d.hasConflict ? "#fef2f2" : "white"),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 10px",
          cursor: d.isCentral ? "default" : "pointer",
          boxShadow: d.isCentral
            ? `0 0 0 4px ${borderColor}33, 0 2px 10px rgba(0,0,0,0.12)`
            : "0 1px 4px rgba(0,0,0,0.08)",
          textAlign: "center",
          userSelect: "none",
          position: "relative",
        }}
      >
        {d.hasConflict && (
          <span style={{ position: "absolute", top: 3, right: 5, fontSize: 9, color: "#dc2626", fontWeight: 700 }}>✕</span>
        )}
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
      <Handle type="source" position={Position.Right}  style={{ opacity: 0, pointerEvents: "none" }} />
    </>
  );
}

const NODE_TYPES = { archimateNode: ArchiNode };
const EDGE_TYPES = { archiEdge: ArchiEdge };

// ── Public props ──────────────────────────────────────────────────────────────

export interface ElementGraphTabProps {
  element: ElementOut;
  allRelationships: RelationshipOut[];
  byId: Map<string, ElementOut>;
}

// ── Graph builder (BFS with filters) ─────────────────────────────────────────

function buildGraph(
  element: ElementOut,
  allRelationships: RelationshipOut[],
  byId: Map<string, ElementOut>,
  depth: number,
  hiddenElementTypes: Set<string>,
  hiddenRelTypes: Set<string>,
  showIndirect: boolean,
  router: ReturnType<typeof useRouter>,
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>();

  function addNode(id: string, label: string, elementType: string, isCentral: boolean) {
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
  }

  // Central element is always shown regardless of filters
  addNode(element.identifier, element.name, element.type, true);

  const eligibleRels = allRelationships.filter((r) => !hiddenRelTypes.has(r.type));
  const visited = new Set<string>([element.identifier]);
  let currentFrontier = new Set<string>([element.identifier]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const rel of eligibleRels) {
      const srcIn = currentFrontier.has(rel.source);
      const tgtIn = currentFrontier.has(rel.target);
      if (!srcIn && !tgtIn) continue;

      const otherId = srcIn ? rel.target : rel.source;
      if (visited.has(otherId)) continue;

      const other = byId.get(otherId);
      const elementType = other?.type ?? "Grouping";
      if (hiddenElementTypes.has(elementType)) continue;

      visited.add(otherId);
      nextFrontier.add(otherId);

      const label =
        other?.name ??
        (srcIn ? (rel.target_name ?? otherId) : (rel.source_name ?? otherId));
      addNode(otherId, label, elementType, false);
    }
    if (nextFrontier.size === 0) break;
    currentFrontier = nextFrontier;
  }

  const allVisibleRels = eligibleRels.filter((r) => visited.has(r.source) && visited.has(r.target));
  const visibleRels = showIndirect
    ? allVisibleRels
    : allVisibleRels.filter((r) => r.source === element.identifier || r.target === element.identifier);

  const conflictNodeIds = new Set<string>();
  for (const r of visibleRels) {
    const src = byId.get(r.source);
    const tgt = byId.get(r.target);
    if (!isRelationshipAllowed(r.type, src?.type, tgt?.type)) {
      conflictNodeIds.add(r.source);
      conflictNodeIds.add(r.target);
    }
  }

  for (const [id, node] of nodeMap) {
    node.data = { ...node.data, hasConflict: conflictNodeIds.has(id) };
  }

  const edges: Edge[] = visibleRels.map((r) => ({
    id: r.identifier,
    source: r.source,
    target: r.target,
    type: "archiEdge",
    label: r.name ? `${r.type} · ${r.name}` : r.type,
    data: { relationshipType: r.type },
  }));

  return { nodes: Array.from(nodeMap.values()), edges };
}

// ── Compute available types (unfiltered BFS) ──────────────────────────────────

function getReachableTypes(
  element: ElementOut,
  allRelationships: RelationshipOut[],
  byId: Map<string, ElementOut>,
  depth: number,
): { elementTypes: string[]; relTypes: string[] } {
  const visited = new Set<string>([element.identifier]);
  let currentFrontier = new Set<string>([element.identifier]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const rel of allRelationships) {
      const srcIn = currentFrontier.has(rel.source);
      const tgtIn = currentFrontier.has(rel.target);
      if (!srcIn && !tgtIn) continue;
      const otherId = srcIn ? rel.target : rel.source;
      if (!visited.has(otherId)) {
        visited.add(otherId);
        nextFrontier.add(otherId);
      }
    }
    if (nextFrontier.size === 0) break;
    currentFrontier = nextFrontier;
  }

  const elementTypes = new Set<string>();
  for (const id of visited) {
    const el = id === element.identifier ? element : byId.get(id);
    if (el) elementTypes.add(el.type);
  }

  const relTypes = new Set<string>();
  for (const rel of allRelationships) {
    if (visited.has(rel.source) && visited.has(rel.target)) relTypes.add(rel.type);
  }

  return { elementTypes: [...elementTypes].sort(), relTypes: [...relTypes].sort() };
}

// ── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({
  availableElementTypes,
  availableRelTypes,
  hiddenElementTypes,
  hiddenRelTypes,
  onChangeElementTypes,
  onChangeRelTypes,
}: {
  availableElementTypes: string[];
  availableRelTypes: string[];
  hiddenElementTypes: Set<string>;
  hiddenRelTypes: Set<string>;
  onChangeElementTypes: (hidden: Set<string>) => void;
  onChangeRelTypes: (hidden: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as HTMLElement)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const totalHidden = hiddenElementTypes.size + hiddenRelTypes.size;

  const elTypesByLayer = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const t of availableElementTypes) {
      const layer = getLayer(t);
      (groups[layer] ??= []).push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [availableElementTypes]);

  function toggleEl(type: string) {
    const next = new Set(hiddenElementTypes);
    if (next.has(type)) next.delete(type); else next.add(type);
    onChangeElementTypes(next);
  }

  function toggleRel(type: string) {
    const next = new Set(hiddenRelTypes);
    if (next.has(type)) next.delete(type); else next.add(type);
    onChangeRelTypes(next);
  }

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)} className="gap-1.5">
        <SlidersHorizontal className="size-3.5" />
        Filtres
        {totalHidden > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] leading-4 font-semibold">
            {totalHidden}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-lg p-3 w-64 max-h-[420px] overflow-y-auto">

          {/* Element types */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Types d'éléments
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                <button type="button" className="text-primary hover:underline" onClick={() => onChangeElementTypes(new Set())}>Tout</button>
                <span className="text-muted-foreground">/</span>
                <button type="button" className="text-primary hover:underline" onClick={() => onChangeElementTypes(new Set(availableElementTypes))}>Aucun</button>
              </div>
            </div>
            {elTypesByLayer.map(([layer, types]) => (
              <div key={layer} className="mb-2">
                <div className="text-[10px] font-medium text-muted-foreground mb-0.5 px-1">{layer}</div>
                {types.map((type) => (
                  <label key={type} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 cursor-pointer">
                    <input type="checkbox" checked={!hiddenElementTypes.has(type)} onChange={() => toggleEl(type)} className="rounded shrink-0" />
                    <span className="text-xs truncate">{type}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* Relation types */}
          {availableRelTypes.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Types de relations
                </span>
                <div className="flex items-center gap-1 text-[10px]">
                  <button type="button" className="text-primary hover:underline" onClick={() => onChangeRelTypes(new Set())}>Tout</button>
                  <span className="text-muted-foreground">/</span>
                  <button type="button" className="text-primary hover:underline" onClick={() => onChangeRelTypes(new Set(availableRelTypes))}>Aucun</button>
                </div>
              </div>
              {availableRelTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 cursor-pointer">
                  <input type="checkbox" checked={!hiddenRelTypes.has(type)} onChange={() => toggleRel(type)} className="rounded shrink-0" />
                  <span className="text-xs truncate">{type}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────

function GraphCanvas({ element, allRelationships, byId }: ElementGraphTabProps) {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const [direction, setDirection] = useState<Direction>("TB");
  const [depth, setDepth] = useState(1);
  const [showIndirect, setShowIndirect] = useState(false);
  const [edgePathType, setEdgePathType] = useState<EdgePathType>("smoothstep");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [hiddenElementTypes, setHiddenElementTypes] = useState<Set<string>>(new Set());
  const [hiddenRelTypes, setHiddenRelTypes] = useState<Set<string>>(new Set());
  const hiddenElRef = useRef<Set<string>>(new Set());
  const hiddenRelRef = useRef<Set<string>>(new Set());

  const [availableElementTypes, setAvailableElementTypes] = useState<string[]>([]);
  const [availableRelTypes, setAvailableRelTypes] = useState<string[]>([]);

  const layout = useCallback(
    (dir: Direction, d: number, hiddenEl: Set<string>, hiddenRel: Set<string>, indirect: boolean) => {
      const { nodes: rawNodes, edges: rawEdges } = buildGraph(
        element, allRelationships, byId, d, hiddenEl, hiddenRel, indirect, router,
      );
      const laid = applyDagreLayout(rawNodes, rawEdges, dir);
      setNodes(laid);
      setEdges(rawEdges);
      setTimeout(() => fitView({ padding: 0.35, duration: 400 }), 50);
    },
    [element, allRelationships, byId, router, setNodes, setEdges, fitView],
  );

  useEffect(() => {
    const { elementTypes, relTypes } = getReachableTypes(element, allRelationships, byId, depth);
    setAvailableElementTypes(elementTypes);
    setAvailableRelTypes(relTypes);
    layout(direction, depth, hiddenElRef.current, hiddenRelRef.current, showIndirect);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, allRelationships, byId, depth, showIndirect]);

  function toggleDirection() {
    const next: Direction = direction === "TB" ? "LR" : "TB";
    setDirection(next);
    layout(next, depth, hiddenElRef.current, hiddenRelRef.current, showIndirect);
  }

  function changeElementTypes(hidden: Set<string>) {
    hiddenElRef.current = hidden;
    setHiddenElementTypes(hidden);
    layout(direction, depth, hidden, hiddenRelRef.current, showIndirect);
  }

  function changeRelTypes(hidden: Set<string>) {
    hiddenRelRef.current = hidden;
    setHiddenRelTypes(hidden);
    layout(direction, depth, hiddenElRef.current, hidden, showIndirect);
  }

  function changeShowIndirect(indirect: boolean) {
    setShowIndirect(indirect);
    layout(direction, depth, hiddenElRef.current, hiddenRelRef.current, indirect);
  }

  const EDGE_PATH_LABELS: Record<EdgePathType, string> = {
    smoothstep: "Lisse",
    bezier: "Bezier",
    step: "Step",
    straight: "Droit",
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className="flex justify-between items-center gap-3 shrink-0">

        {/* Left: Filtres + Profondeur + Relations */}
        <div className="flex items-center gap-3">
          <FilterPanel
            availableElementTypes={availableElementTypes}
            availableRelTypes={availableRelTypes}
            hiddenElementTypes={hiddenElementTypes}
            hiddenRelTypes={hiddenRelTypes}
            onChangeElementTypes={changeElementTypes}
            onChangeRelTypes={changeRelTypes}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Profondeur</span>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepth(d)}
                className={`w-6 h-6 text-xs rounded border transition-colors ${
                  depth === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-ring"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Relations</span>
            {([false, true] as const).map((indirect) => (
              <button
                key={String(indirect)}
                type="button"
                onClick={() => changeShowIndirect(indirect)}
                className={`text-xs px-2 h-6 rounded border transition-colors ${
                  showIndirect === indirect
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-ring"
                }`}
              >
                {indirect ? "Indirect" : "Direct"}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Edge type + direction */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Edges</span>
            {(["smoothstep", "bezier", "step", "straight"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEdgePathType(type)}
                className={`text-xs px-2 h-6 rounded border transition-colors ${
                  edgePathType === type
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-ring"
                }`}
              >
                {EDGE_PATH_LABELS[type]}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={toggleDirection}>
            {direction === "TB" ? "→" : "↓"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden relative" style={{ height: "100%" }}>
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
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function ElementGraphTab(props: ElementGraphTabProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
