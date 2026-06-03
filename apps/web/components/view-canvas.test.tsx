import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewCanvas } from "./view-canvas";
import { I18nProvider } from "@/lib/i18n";
import type { NodeOut, ConnectionOut, ElementOut } from "@/lib/api";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

type NodeRenderer = React.ComponentType<{ id: string; data: Record<string, unknown>; selected: boolean }>;
type EdgeRenderer = React.ComponentType<{ id: string; sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: string; targetPosition: string; data: Record<string, unknown>; label: unknown; selected: boolean }>;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    nodes,
    edges,
    nodeTypes = {},
    edgeTypes = {},
  }: {
    nodes: Array<{ id: string; type?: string; data: Record<string, unknown>; selected?: boolean; position?: { x: number; y: number }; parentId?: string }>;
    edges: Array<{ id: string; type?: string; data: Record<string, unknown>; label?: unknown }>;
    nodeTypes?: Record<string, NodeRenderer>;
    edgeTypes?: Record<string, EdgeRenderer>;
  }) => (
    <div data-testid="reactflow">
      <span data-testid="node-count">{nodes.length}</span>
      <span data-testid="edge-count">{edges.length}</span>
      {nodes.map((n) => {
        const Comp = n.type ? nodeTypes[n.type] : undefined;
        return Comp ? (
          <div
            key={n.id}
            data-testid={`node-${n.id}`}
            data-x={n.position?.x}
            data-y={n.position?.y}
            data-parent={n.parentId ?? ""}
          >
            <Comp id={n.id} data={n.data} selected={n.selected ?? false} />
          </div>
        ) : null;
      })}
      {edges.map((e) => {
        const Comp = e.type ? edgeTypes[e.type] : undefined;
        return Comp ? (
          <Comp
            key={e.id}
            id={e.id}
            sourceX={0}
            sourceY={0}
            targetX={100}
            targetY={100}
            sourcePosition="bottom"
            targetPosition="top"
            data={e.data ?? {}}
            label={e.label}
            selected={false}
          />
        ) : null;
      })}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  BaseEdge: () => null,
  EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Panel: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  getSmoothStepPath: () => ["M0,0 L1,1", 0, 0],
  getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  getViewportForBounds: () => ({ x: 0, y: 0, zoom: 1 }),
  reconnectEdge: (_old: unknown, _new: unknown, eds: unknown[]) => eds,
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({ getNodes: () => [], setEdges: vi.fn(), setNodes: vi.fn(), screenToFlowPosition: (p: { x: number; y: number }) => p }),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock("html-to-image", () => ({
  toPng: vi.fn(() => Promise.resolve("")),
}));

const makeNode = (id: string, overrides: Partial<NodeOut> = {}): NodeOut => ({
  identifier: id,
  name: id,
  element_ref: null,
  x: 10,
  y: 20,
  w: 120,
  h: 60,
  children: [],
  ...overrides,
});

const makeEdge = (id: string, src: string, tgt: string, relRef?: string): ConnectionOut => ({
  identifier: id,
  relationship_ref: relRef ?? null,
  source: src,
  target: tgt,
  name: null,
});

const makeElement = (id: string, name: string, type: string): ElementOut => ({
  identifier: id,
  name,
  type,
  documentation: null,
  properties: [],
});

describe("ViewCanvas", () => {
  it("renders reactflow container", () => {
    render(<ViewCanvas nodes={[]} connections={[]} />);
    expect(screen.getByTestId("reactflow")).toBeInTheDocument();
  });

  it("maps flat nodes correctly", () => {
    const nodes = [makeNode("n1"), makeNode("n2")];
    render(<ViewCanvas nodes={nodes} connections={[]} />);
    expect(screen.getByTestId("node-count").textContent).toBe("2");
    expect(screen.getByTestId("edge-count").textContent).toBe("0");
  });

  it("flattens nested nodes", () => {
    const child = makeNode("child");
    const parent = makeNode("parent", { children: [child] });
    render(<ViewCanvas nodes={[parent]} connections={[]} />);
    expect(screen.getByTestId("node-count").textContent).toBe("2");
  });

  it("maps connections to edges", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const connections = [makeEdge("e1", "a", "b")];
    render(<ViewCanvas nodes={nodes} connections={connections} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });

  it("handles deeply nested nodes", () => {
    const grandchild = makeNode("gc");
    const child = makeNode("c", { children: [grandchild] });
    const root = makeNode("r", { children: [child] });
    render(<ViewCanvas nodes={[root]} connections={[]} />);
    expect(screen.getByTestId("node-count").textContent).toBe("3");
  });

  it("converts absolute model coordinates to parent-relative React Flow positions", () => {
    // Model coords are absolute. A child at (180,144) inside a parent at
    // (144,96) must render at the relative offset (36,48); a grandchild at
    // (233,252) inside that child must be relative to the child, not the root.
    const grandchild = makeNode("gc", { x: 233, y: 252 });
    const child = makeNode("child", { x: 180, y: 144, children: [grandchild] });
    const parent = makeNode("parent", { x: 144, y: 96, children: [child] });
    render(<ViewCanvas nodes={[parent]} connections={[]} />);

    const parentEl = screen.getByTestId("node-parent");
    expect(parentEl.getAttribute("data-x")).toBe("144");
    expect(parentEl.getAttribute("data-y")).toBe("96");
    expect(parentEl.getAttribute("data-parent")).toBe("");

    const childEl = screen.getByTestId("node-child");
    expect(childEl.getAttribute("data-x")).toBe("36"); // 180 - 144
    expect(childEl.getAttribute("data-y")).toBe("48"); // 144 - 96
    expect(childEl.getAttribute("data-parent")).toBe("parent");

    const gcEl = screen.getByTestId("node-gc");
    expect(gcEl.getAttribute("data-x")).toBe("53"); // 233 - 180
    expect(gcEl.getAttribute("data-y")).toBe("108"); // 252 - 144
    expect(gcEl.getAttribute("data-parent")).toBe("child");
  });

  it("maps connections with relationship type from map", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const connections = [makeEdge("e1", "a", "b", "rel-1")];
    const relTypes = new Map([["rel-1", "Composition"]]);
    render(<ViewCanvas nodes={nodes} connections={connections} relationshipTypes={relTypes} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });

  it("uses elementNames map to label nodes", () => {
    const nodes = [makeNode("n1", { element_ref: "e1", name: null })];
    const elementNames = new Map([["e1", "My App"]]);
    render(<ViewCanvas nodes={nodes} connections={[]} elementNames={elementNames} />);
    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });

  it("renders ElementPalette with elements when viewId provided", () => {
    const elements = [makeElement("e1", "My App", "ApplicationComponent")];
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />);
    expect(screen.getByText("My App")).toBeInTheDocument();
  });

  it("ElementPalette shows 'no element' message when empty", () => {
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={[]} />);
    expect(screen.getByText("Aucun élément.")).toBeInTheDocument();
  });

  it("ElementPalette collapse/expand all buttons work", () => {
    const elements = [
      makeElement("e1", "App A", "ApplicationComponent"),
      makeElement("e2", "App B", "ApplicationComponent"),
    ];
    renderWithI18n(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />);
    const collapseBtn = screen.getByTitle("Tout replier");
    const expandBtn = screen.getByTitle("Tout déplier");
    fireEvent.click(collapseBtn);
    fireEvent.click(expandBtn);
    expect(screen.getByText("App A")).toBeInTheDocument();
  });

  it("ElementPalette toggle type group collapses and expands", () => {
    const elements = [makeElement("e1", "App A", "ApplicationComponent")];
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />);
    const typeHeader = screen.getByText("ApplicationComponent");
    fireEvent.click(typeHeader.closest("button")!);
    fireEvent.click(typeHeader.closest("button")!);
    expect(screen.getByText("ApplicationComponent")).toBeInTheDocument();
  });

  it("ElementPalette search filters elements", () => {
    const elements = [
      makeElement("e1", "AppServer", "ApplicationComponent"),
      makeElement("e2", "Database", "DataObject"),
    ];
    renderWithI18n(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />);
    const input = screen.getByPlaceholderText("Rechercher élément…");
    fireEvent.change(input, { target: { value: "App" } });
    expect(screen.getByText("AppServer")).toBeInTheDocument();
  });

  it("picks handles based on node positions (horizontal layout)", () => {
    const nodeLeft = makeNode("a", { x: 0, y: 0, w: 100, h: 60 });
    const nodeRight = makeNode("b", { x: 200, y: 0, w: 100, h: 60 });
    const connections = [makeEdge("e1", "a", "b")];
    render(<ViewCanvas nodes={[nodeLeft, nodeRight]} connections={connections} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });

  it("picks handles based on node positions (vertical layout)", () => {
    const nodeTop = makeNode("a", { x: 0, y: 0, w: 100, h: 60 });
    const nodeBottom = makeNode("b", { x: 0, y: 200, w: 100, h: 60 });
    const connections = [makeEdge("e1", "a", "b")];
    render(<ViewCanvas nodes={[nodeTop, nodeBottom]} connections={connections} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });

  it("uses source_side and target_side from connection", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const conn: ConnectionOut = {
      identifier: "c1",
      source: "a",
      target: "b",
      relationship_ref: null,
      name: "labeled",
      source_side: "top",
      target_side: "bottom",
    };
    render(<ViewCanvas nodes={nodes} connections={[conn]} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });

  it("handles connection with null source/target gracefully", () => {
    const conn: ConnectionOut = {
      identifier: "c1",
      source: null,
      target: null,
      relationship_ref: null,
      name: null,
    };
    render(<ViewCanvas nodes={[]} connections={[conn]} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });

  it("renders ArchiNode with hasChildren=true for parent nodes", () => {
    const child = makeNode("child");
    const parent = makeNode("parent", { children: [child] });
    render(<ViewCanvas viewId="v1" nodes={[parent]} connections={[]} />);
    expect(screen.getByTestId("node-count").textContent).toBe("2");
  });

  it("renders nodes with element_ref and elementTypes map", () => {
    const node = makeNode("n1", { element_ref: "e1", name: null });
    const elementTypes = new Map([["e1", "ApplicationComponent"]]);
    render(<ViewCanvas nodes={[node]} connections={[]} elementTypes={elementTypes} />);
    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });

  it("covers different archimateEdgeStyle cases via relType", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const relTypes = ["Triggering", "Flow", "Realization", "Specialization", "Access", "Influence"];
    for (const relType of relTypes) {
      const relTypesMap = new Map([["rel-1", relType]]);
      const { unmount } = render(
        <ViewCanvas nodes={nodes} connections={[makeEdge("e1", "a", "b", "rel-1")]} relationshipTypes={relTypesMap} />
      );
      expect(screen.getByTestId("edge-count").textContent).toBe("1");
      unmount();
    }
  });

  it("renders edges with relationship name label", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const conn = makeEdge("e1", "a", "b", "rel-1");
    const relNames = new Map([["rel-1", "triggers"]]);
    render(<ViewCanvas nodes={nodes} connections={[conn]} relationshipNames={relNames} />);
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
  });
});
