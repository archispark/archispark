import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewCanvas } from "./view-canvas";
import type { NodeOut, ConnectionOut } from "@/lib/api";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => (
    <div data-testid="reactflow">
      <span data-testid="node-count">{nodes.length}</span>
      <span data-testid="edge-count">{edges.length}</span>
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
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({ getNodes: () => [] }),
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

const makeEdge = (id: string, src: string, tgt: string): ConnectionOut => ({
  identifier: id,
  relationship_ref: null,
  source: src,
  target: tgt,
  name: null,
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
});
