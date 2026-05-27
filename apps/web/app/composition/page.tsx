"use client";

import { useEffect, useState, useMemo } from "react";
import {
  fetchElements,
  fetchRelationships,
  type ElementOut,
  type RelationshipOut,
} from "@/lib/api";
import { ChevronDown, ChevronRight } from "lucide-react";

interface TreeNode {
  el: ElementOut;
  children: TreeNode[];
}

const LAYER_COLORS: Record<string, string> = {
  Business: "#d97706",
  Application: "#2563eb",
  Technology: "#16a34a",
  Physical: "#059669",
  Motivation: "#7c3aed",
  Strategy: "#dc2626",
  Implementation: "#ea580c",
  Composite: "#64748b",
};

function getLayer(type: string): string {
  if (type.startsWith("Business") || ["Contract", "Representation", "Product"].includes(type))
    return "Business";
  if (type.startsWith("Application") || type === "DataObject") return "Application";
  if (
    type.startsWith("Technology") ||
    ["Node", "Device", "SystemSoftware", "Path", "CommunicationNetwork", "Artifact"].includes(type)
  )
    return "Technology";
  if (["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)) return "Physical";
  if (
    ["Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle", "Requirement", "Constraint", "Meaning", "Value"].includes(type)
  )
    return "Motivation";
  if (["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)) return "Strategy";
  if (["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"].includes(type))
    return "Implementation";
  return "Composite";
}

function buildTree(elements: ElementOut[], relationships: RelationshipOut[]): TreeNode[] {
  const elMap = new Map(elements.map((e) => [e.identifier, e]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const rel of relationships) {
    if (rel.type === "Composition") {
      const kids = childrenOf.get(rel.source) || [];
      kids.push(rel.target);
      childrenOf.set(rel.source, kids);
      hasParent.add(rel.target);
    }
  }

  function buildNode(id: string): TreeNode | null {
    const el = elMap.get(id);
    if (!el) return null;
    const childIds = childrenOf.get(id) || [];
    const children = childIds
      .map(buildNode)
      .filter(Boolean)
      .sort((a, b) => a!.el.name.localeCompare(b!.el.name)) as TreeNode[];
    return { el, children };
  }

  const roots = elements
    .filter((e) => !hasParent.has(e.identifier) && childrenOf.has(e.identifier))
    .sort((a, b) => a.name.localeCompare(b.name));

  return roots.map((r) => buildNode(r.identifier)).filter(Boolean) as TreeNode[];
}

function countDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const c of node.children) count += countDescendants(c);
  return count;
}

function TreeNodeRow({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isCollapsed = collapsed.has(node.el.identifier);
  const layer = getLayer(node.el.type);
  const color = LAYER_COLORS[layer] ?? "#64748b";
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-3 rounded-md hover:bg-muted/50 transition-colors group"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.el.identifier)}
            className="flex items-center justify-center size-4 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : (
          <span className="size-4 shrink-0 flex items-center justify-center">
            <span className="size-1.5 rounded-full bg-border" />
          </span>
        )}

        <span
          className="size-2 rounded-full shrink-0"
          style={{ background: color }}
        />

        <span className="text-[13px] font-medium text-foreground flex-1 truncate">
          {node.el.name || node.el.identifier}
        </span>

        <span className="text-[11px] text-muted-foreground font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.el.type}
        </span>

        {hasChildren && (
          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {node.children.length}
          </span>
        )}
      </div>

      {!isCollapsed && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.el.identifier}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompositionPage() {
  const [elements, setElements] = useState<ElementOut[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([fetchElements(), fetchRelationships()])
      .then(([e, r]) => {
        setElements(e);
        setRelationships(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const tree = useMemo(() => buildTree(elements, relationships), [elements, relationships]);

  const totalCompositions = useMemo(
    () => relationships.filter((r) => r.type === "Composition").length,
    [relationships]
  );

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(tree.map((n) => n.el.identifier)));
  }

  function expandAll() {
    const allIds = new Set<string>();
    function collect(node: TreeNode) {
      allIds.add(node.el.identifier);
      node.children.forEach(collect);
    }
    tree.forEach(collect);
    setCollapsed(new Set());
    void allIds;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Relations de Composition</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {tree.length} racines · {totalCompositions} compositions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            Tout déplier
          </button>
          <button
            onClick={collapseAll}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            Tout replier
          </button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[40px] mb-3.5">🔗</div>
          <p className="text-sm">Aucune relation de Composition trouvée dans le modèle.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {tree.map((root) => {
              const desc = countDescendants(root);
              const isCollapsed = collapsed.has(root.el.identifier);
              const layer = getLayer(root.el.type);
              const color = LAYER_COLORS[layer] ?? "#64748b";
              return (
                <div key={root.el.identifier}>
                  <button
                    onClick={() => toggle(root.el.identifier)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <span className="font-semibold text-[13px] flex-1">
                      {root.el.name || root.el.identifier}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {root.el.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">
                      {desc} élément{desc !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="py-1">
                      {root.children.map((child) => (
                        <TreeNodeRow
                          key={child.el.identifier}
                          node={child}
                          depth={0}
                          collapsed={collapsed}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
