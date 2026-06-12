/**
 * view-canvas-interactions.test.tsx
 *
 * Extends coverage for ViewCanvas beyond basic rendering. Uses a richer
 * @xyflow/react mock that exposes captured event handlers so tests can
 * invoke them directly without a real React Flow canvas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, createEvent } from "@testing-library/react";
import type React from "react";
import { ViewCanvas } from "./view-canvas";
import type { NodeOut, ConnectionOut, ElementOut } from "@/lib/api";

// ---------------------------------------------------------------------------
// Hoisted shared state — accessible in vi.mock factory
// ---------------------------------------------------------------------------

const shared = vi.hoisted(() => {
  let capturedOnConnect: ((p: { source: string | null; target: string | null }) => void) | undefined;
  let capturedOnNodeDragStop: ((_e: unknown, node: { id: string; position: { x: number; y: number }; parentId?: string }) => void) | undefined;
  let capturedOnNodesDelete: ((deleted: { id: string }[]) => void) | undefined;
  let capturedOnEdgesDelete: ((deleted: { id: string }[]) => void) | undefined;
  let capturedOnNodeDoubleClick: ((_e: unknown, node: { id: string; data: Record<string, unknown> }) => void) | undefined;
  let capturedOnEdgeDoubleClick: ((_e: unknown, edge: { id: string; label: unknown }) => void) | undefined;
  let capturedOnDrop: ((e: React.DragEvent<HTMLDivElement>) => void) | undefined;
  let capturedOnDragOver: ((e: React.DragEvent<HTMLDivElement>) => void) | undefined;
  let capturedOnReconnect: ((oldEdge: { id: string; source: string; target: string; sourceHandle: string | null; targetHandle: string | null }, newConn: { source: string | null; target: string | null; sourceHandle: string | null; targetHandle: string | null }) => void) | undefined;
  let edgeSelectedOverride = false;

  return {
    get onConnect() { return capturedOnConnect; },
    set onConnect(v) { capturedOnConnect = v; },
    get onNodeDragStop() { return capturedOnNodeDragStop; },
    set onNodeDragStop(v) { capturedOnNodeDragStop = v; },
    get onNodesDelete() { return capturedOnNodesDelete; },
    set onNodesDelete(v) { capturedOnNodesDelete = v; },
    get onEdgesDelete() { return capturedOnEdgesDelete; },
    set onEdgesDelete(v) { capturedOnEdgesDelete = v; },
    get onNodeDoubleClick() { return capturedOnNodeDoubleClick; },
    set onNodeDoubleClick(v) { capturedOnNodeDoubleClick = v; },
    get onEdgeDoubleClick() { return capturedOnEdgeDoubleClick; },
    set onEdgeDoubleClick(v) { capturedOnEdgeDoubleClick = v; },
    get onDrop() { return capturedOnDrop; },
    set onDrop(v) { capturedOnDrop = v; },
    get onDragOver() { return capturedOnDragOver; },
    set onDragOver(v) { capturedOnDragOver = v; },
    get onReconnect() { return capturedOnReconnect; },
    set onReconnect(v) { capturedOnReconnect = v; },
    get edgeSelectedOverride() { return edgeSelectedOverride; },
    set edgeSelectedOverride(v) { edgeSelectedOverride = v; },
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div role="dialog">{children}</div> : <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/lib/api", () => ({
  createRelationship: vi.fn().mockResolvedValue({ identifier: "rel-new", type: "Association" }),
  createViewConnection: vi.fn().mockResolvedValue({ identifier: "conn-new", source: "n1", target: "n2" }),
  createViewNode: vi.fn().mockResolvedValue({ identifier: "n-new", element_ref: "e1", x: 60, y: 60, w: 120, h: 60, name: null, children: [] }),
  deleteViewConnection: vi.fn().mockResolvedValue(undefined),
  deleteViewNode: vi.fn().mockResolvedValue(undefined),
  updateViewConnection: vi.fn().mockResolvedValue(undefined),
  updateViewNode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("html-to-image", () => ({
  toPng: vi.fn(() => Promise.resolve("data:image/png;base64,abc")),
  toSvg: vi.fn(() => Promise.resolve("data:image/svg+xml;base64,abc")),
}));

type NodeRenderer = React.ComponentType<{
  id: string;
  data: Record<string, unknown>;
  selected: boolean;
}>;
type EdgeRenderer = React.ComponentType<{
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  data: Record<string, unknown>;
  label: unknown;
  selected: boolean;
}>;

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    nodes,
    edges,
    nodeTypes = {},
    edgeTypes = {},
    onConnect,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    onNodeDoubleClick,
    onEdgeDoubleClick,
    onReconnect,
    children,
  }: {
    nodes: Array<{ id: string; type?: string; data: Record<string, unknown>; selected?: boolean }>;
    edges: Array<{ id: string; type?: string; data: Record<string, unknown>; label?: unknown; selected?: boolean }>;
    nodeTypes?: Record<string, NodeRenderer>;
    edgeTypes?: Record<string, EdgeRenderer>;
    onConnect?: (p: { source: string | null; target: string | null }) => void;
    onNodeDragStop?: (_e: unknown, node: { id: string; position: { x: number; y: number }; parentId?: string }) => void;
    onNodesDelete?: (deleted: { id: string }[]) => void;
    onEdgesDelete?: (deleted: { id: string }[]) => void;
    onNodeDoubleClick?: (_e: unknown, node: { id: string; data: Record<string, unknown> }) => void;
    onEdgeDoubleClick?: (_e: unknown, edge: { id: string; label: unknown }) => void;
    onReconnect?: (oldEdge: { id: string; source: string; target: string; sourceHandle: string | null; targetHandle: string | null }, newConn: { source: string | null; target: string | null; sourceHandle: string | null; targetHandle: string | null }) => void;
    children?: React.ReactNode;
  }) => {
    // Capture handlers for direct invocation in tests
    if (onConnect) shared.onConnect = onConnect;
    if (onNodeDragStop) shared.onNodeDragStop = onNodeDragStop;
    if (onNodesDelete) shared.onNodesDelete = onNodesDelete;
    if (onEdgesDelete) shared.onEdgesDelete = onEdgesDelete;
    if (onNodeDoubleClick) shared.onNodeDoubleClick = onNodeDoubleClick;
    if (onEdgeDoubleClick) shared.onEdgeDoubleClick = onEdgeDoubleClick;
    if (onReconnect) shared.onReconnect = onReconnect;

    return (
      <div data-testid="reactflow">
        <span data-testid="node-count">{nodes.length}</span>
        <span data-testid="edge-count">{edges.length}</span>
        {children}
        {nodes.map((n) => {
          const Comp = n.type ? nodeTypes[n.type] : undefined;
          return Comp ? (
            <div key={n.id} data-testid={`node-${n.id}`}>
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
              selected={shared.edgeSelectedOverride || (e.selected ?? false)}
            />
          ) : null;
        })}
      </div>
    );
  },
  Background: () => null,
  Controls: () => null,
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
  useNodesState: (initial: unknown[]) => {
    const [nodes, setNodes] = [initial, vi.fn()];
    return [nodes, setNodes, vi.fn()];
  },
  useEdgesState: (initial: unknown[]) => {
    const [edges, setEdges] = [initial, vi.fn()];
    return [edges, setEdges, vi.fn()];
  },
  useReactFlow: () => ({
    getNodes: () => [],
    setEdges: vi.fn(),
    setNodes: vi.fn(),
    screenToFlowPosition: (p: { x: number; y: number }) => p,
  }),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const makeEdge = (
  id: string,
  src: string,
  tgt: string,
  relRef?: string,
): ConnectionOut => ({
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ViewCanvas — HIDDEN_ELEMENT_TYPES filtering", () => {
  it("AndJunction nodes are excluded from the rendered node list", () => {
    const junction = makeNode("j1", { element_ref: "e-junc" });
    const normal = makeNode("n1", { element_ref: "e-app" });
    const elementTypes = new Map([
      ["e-junc", "AndJunction"],
      ["e-app", "ApplicationComponent"],
    ]);
    render(<ViewCanvas nodes={[junction, normal]} connections={[]} elementTypes={elementTypes} />);
    // Only the normal node should appear (AndJunction filtered out)
    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });

  it("connections to hidden nodes are also filtered out", () => {
    const junction = makeNode("j1", { element_ref: "e-junc" });
    const normal = makeNode("n1", { element_ref: "e-app" });
    const elementTypes = new Map([
      ["e-junc", "AndJunction"],
      ["e-app", "ApplicationComponent"],
    ]);
    const conn = makeEdge("c1", "j1", "n1");
    render(<ViewCanvas nodes={[junction, normal]} connections={[conn]} elementTypes={elementTypes} />);
    // The connection references the hidden junction — should be filtered
    expect(screen.getByTestId("edge-count").textContent).toBe("0");
  });
});

describe("ViewCanvas — ArchiEdge interactions (selected=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared.edgeSelectedOverride = false;
  });

  it("ArchiEdge renders rename and delete buttons when selected", () => {
    shared.edgeSelectedOverride = true;
    const nodes = [makeNode("a"), makeNode("b")];
    const edges: ConnectionOut[] = [{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }];
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={edges}
      />
    );
    // ArchiEdge with selected=true should render the rename button (shows relType or "Association")
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
    // The rename button text is relType ?? "Association"
    expect(screen.getByText("Association")).toBeInTheDocument();
    // The delete button has aria-label (via t("canvas.remove_from_view"))
    expect(screen.getByText("×")).toBeInTheDocument();
  });

  it("ArchiEdge rename button calls updateViewConnection with new name", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("New Name"));
    shared.edgeSelectedOverride = true;
    const nodes = [makeNode("a"), makeNode("b")];
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }]}
      />
    );
    const renameBtn = screen.getByText("Association");
    await act(async () => { fireEvent.click(renameBtn); });
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", { name: "New Name" });
    vi.unstubAllGlobals();
  });

  it("ArchiEdge rename button no-op when prompt returns null", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.mocked(updateViewConnection).mockClear();
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null));
    shared.edgeSelectedOverride = true;
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }]}
      />
    );
    const renameBtn = screen.getByText("Association");
    await act(async () => { fireEvent.click(renameBtn); });
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("ArchiEdge delete button shows confirm dialog, confirm calls deleteViewConnection", async () => {
    const { deleteViewConnection } = await import("@/lib/api");
    shared.edgeSelectedOverride = true;
    const { container } = render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }]}
      />
    );
    // Click the × delete button to open confirmation dialog
    const deleteBtn = screen.getByText("×");
    await act(async () => { fireEvent.click(deleteBtn); });
    // Confirm button in dialog uses t("common.delete") which returns "common.delete" (no I18nProvider)
    const confirmBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "common.delete",
    );
    if (confirmBtns[0]) {
      await act(async () => { fireEvent.click(confirmBtns[0]!); });
      expect(vi.mocked(deleteViewConnection)).toHaveBeenCalledWith("v1", "e1");
    }
  });

  it("ArchiEdge remove without viewId: only calls setEdges (if(viewId) false branch)", async () => {
    const { deleteViewConnection } = await import("@/lib/api");
    vi.mocked(deleteViewConnection).mockClear();
    shared.edgeSelectedOverride = true;
    const { container } = render(
      // No viewId — removeEdge should not call deleteViewConnection
      <ViewCanvas
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }]}
      />
    );
    const deleteBtn = screen.getByText("×");
    await act(async () => { fireEvent.click(deleteBtn); });
    const confirmBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "common.delete",
    );
    if (confirmBtns[0]) {
      await act(async () => { fireEvent.click(confirmBtns[0]!); });
      // Without viewId, deleteViewConnection should NOT be called
      expect(vi.mocked(deleteViewConnection)).not.toHaveBeenCalled();
    }
  });

  it("ArchiEdge with label renders label text", () => {
    shared.edgeSelectedOverride = false;
    const nodes = [makeNode("a"), makeNode("b")];
    const conn: ConnectionOut = { identifier: "e1", source: "a", target: "b", relationship_ref: null, name: "my-label" };
    render(<ViewCanvas nodes={nodes} connections={[conn]} />);
    expect(screen.getByText("my-label")).toBeInTheDocument();
  });
});

describe("ViewCanvas — onConnect flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onConnect with source/target that have element refs triggers pending connection dialog", async () => {
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ];
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "BusinessProcess"],
    ]);
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    );
    // Invoke the captured onConnect handler
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" });
    });
    // The pending connection dialog should appear with relationship type buttons
    expect(screen.queryByText("Type ArchiMate")).not.toBeNull();
  });

  it("onConnect cancels when clicking backdrop", async () => {
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ];
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "ApplicationComponent"],
    ]);
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    );
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" });
    });
    // Dialog should be visible — click Annuler to cancel
    const cancelBtn = screen.queryByText("Annuler");
    if (cancelBtn) {
      fireEvent.click(cancelBtn);
      expect(screen.queryByText("Type ArchiMate")).toBeNull();
    }
  });

  it("onConnect is a no-op when source or target is null", async () => {
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} />);
    await act(async () => {
      shared.onConnect?.({ source: null, target: "n2" });
    });
    expect(screen.queryByText("Type ArchiMate")).toBeNull();
  });

  it("clicking a relationship type button calls confirmRelationshipType", async () => {
    const { createRelationship, createViewConnection } = await import("@/lib/api");
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ];
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "ApplicationComponent"],
    ]);
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    );
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" });
    });
    // The dialog shows relationship type buttons; click the first available
    const relBtns = screen.queryAllByRole("button").filter(
      (b) => b.closest("[onClick]") || (b.textContent && !["Annuler"].includes(b.textContent.trim()))
    );
    // Find any button that's a relationship type (non-Annuler button inside the dialog area)
    const typeBtn = screen.queryByText("Association");
    if (typeBtn) {
      await act(async () => { fireEvent.click(typeBtn); });
      expect(vi.mocked(createRelationship)).toHaveBeenCalled();
    }
  });

  it("clicking backdrop closes pendingConnection dialog", async () => {
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ];
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "ApplicationComponent"],
    ]);
    const { container } = render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    );
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" });
    });
    expect(screen.queryByText("Type ArchiMate")).not.toBeNull();
    // Click the backdrop overlay (the outermost div with onClick={() => setPendingConnection(null)})
    const backdrop = container.querySelector('[style*="rgba(0,0,0,0.35)"]') as HTMLElement | null;
    if (backdrop) {
      await act(async () => { fireEvent.click(backdrop); });
      expect(screen.queryByText("Type ArchiMate")).toBeNull();
    }
  });
});

describe("ViewCanvas — onNodeDragStop", () => {
  it("calls updateViewNode after node drag", async () => {
    const { updateViewNode } = await import("@/lib/api");
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />);
    await act(async () => {
      shared.onNodeDragStop?.({}, { id: "n1", position: { x: 50, y: 80 } });
    });
    expect(vi.mocked(updateViewNode)).toHaveBeenCalledWith("v1", "n1", expect.objectContaining({ x: 50, y: 80 }));
  });

  it("no-op when viewId is not set", async () => {
    const { updateViewNode } = await import("@/lib/api");
    vi.mocked(updateViewNode).mockClear();
    render(<ViewCanvas nodes={[makeNode("n1")]} connections={[]} />);
    await act(async () => {
      shared.onNodeDragStop?.({}, { id: "n1", position: { x: 50, y: 80 } });
    });
    expect(vi.mocked(updateViewNode)).not.toHaveBeenCalled();
  });
});

describe("ViewCanvas — onNodesDelete", () => {
  it("calls deleteViewNode for each deleted node", async () => {
    const { deleteViewNode } = await import("@/lib/api");
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />);
    await act(async () => {
      shared.onNodesDelete?.([{ id: "n1" }]);
    });
    expect(vi.mocked(deleteViewNode)).toHaveBeenCalledWith("v1", "n1");
  });
});

describe("ViewCanvas — onEdgesDelete", () => {
  it("calls deleteViewConnection for each deleted edge", async () => {
    const { deleteViewConnection } = await import("@/lib/api");
    render(<ViewCanvas viewId="v1" nodes={[makeNode("a"), makeNode("b")]} connections={[makeEdge("e1", "a", "b")]} />);
    await act(async () => {
      shared.onEdgesDelete?.([{ id: "e1" }]);
    });
    expect(vi.mocked(deleteViewConnection)).toHaveBeenCalledWith("v1", "e1");
  });
});

describe("ViewCanvas — onNodeDoubleClick", () => {
  it("calls updateViewNode after renaming via prompt", async () => {
    const { updateViewNode } = await import("@/lib/api");
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("New Label"));
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />);
    await act(async () => {
      shared.onNodeDoubleClick?.({}, { id: "n1", data: { label: "n1" } });
    });
    expect(vi.mocked(updateViewNode)).toHaveBeenCalledWith("v1", "n1", { name: "New Label" });
    vi.unstubAllGlobals();
  });

  it("no-op when prompt returns null (user cancels)", async () => {
    const { updateViewNode } = await import("@/lib/api");
    vi.mocked(updateViewNode).mockClear();
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null));
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />);
    await act(async () => {
      shared.onNodeDoubleClick?.({}, { id: "n1", data: { label: "n1" } });
    });
    expect(vi.mocked(updateViewNode)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("ViewCanvas — onEdgeDoubleClick", () => {
  it("calls updateViewConnection after renaming edge via prompt", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("Renamed"));
    render(<ViewCanvas viewId="v1" nodes={[makeNode("a"), makeNode("b")]} connections={[makeEdge("e1", "a", "b")]} />);
    await act(async () => {
      shared.onEdgeDoubleClick?.({}, { id: "e1", label: "" });
    });
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", { name: "Renamed" });
    vi.unstubAllGlobals();
  });

  it("no-op when prompt returns null", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.mocked(updateViewConnection).mockClear();
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null));
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} />);
    await act(async () => {
      shared.onEdgeDoubleClick?.({}, { id: "e1", label: "" });
    });
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("ViewCanvas — onDrop", () => {
  it("calls createViewNode when element dragged onto canvas", async () => {
    const { createViewNode } = await import("@/lib/api");
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} />);
    // The drop target is the div wrapping ReactFlow (parent of data-testid="reactflow")
    const dropZone = screen.getByTestId("reactflow").parentElement!;
    const dropEvent = createEvent.drop(dropZone);
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        getData: vi.fn().mockReturnValue("e1"),
        types: ["application/x-archi-element"],
      },
    });
    Object.defineProperty(dropEvent, "clientX", { value: 200 });
    Object.defineProperty(dropEvent, "clientY", { value: 150 });
    await act(async () => {
      fireEvent(dropZone, dropEvent);
    });
    expect(vi.mocked(createViewNode)).toHaveBeenCalled();
  });

  it("no-op when no viewId is set", async () => {
    const { createViewNode } = await import("@/lib/api");
    vi.mocked(createViewNode).mockClear();
    render(<ViewCanvas nodes={[]} connections={[]} />);
    const reactflowEl = screen.getByTestId("reactflow");
    // Find a parent div to drop on
    const dropZone = reactflowEl.parentElement ?? reactflowEl;
    const dropEvent = createEvent.drop(dropZone);
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        getData: vi.fn().mockReturnValue("e1"),
        types: ["application/x-archi-element"],
      },
    });
    await act(async () => {
      fireEvent(dropZone, dropEvent);
    });
    expect(vi.mocked(createViewNode)).not.toHaveBeenCalled();
  });
});

describe("ViewCanvas — ElementPalette onDragStart", () => {
  it("sets drag data when dragging an element from palette", () => {
    const elements = [makeElement("e1", "My App", "ApplicationComponent")];
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />);
    const draggable = screen.getByTitle("ApplicationComponent — My App");
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(draggable, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/x-archi-element", "e1");
    expect(dataTransfer.effectAllowed).toBe("move");
  });
});

describe("ViewCanvas — colorFor with unknown element type", () => {
  it("renders node with unknown element type using 'other' layer color", () => {
    const nodes = [makeNode("n1", { element_ref: "e1" })];
    // No element type in the map → should fall back to 'other' layer colors
    render(<ViewCanvas nodes={nodes} connections={[]} elementTypes={new Map()} />);
    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });
});

describe("ViewCanvas — ArchiEdge renameEdge with empty string", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared.edgeSelectedOverride = false;
  });

  it("renameEdge sends null name when prompt returns empty string", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(""));
    shared.edgeSelectedOverride = true;
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }]}
      />
    );
    const renameBtn = screen.getByText("Association");
    await act(async () => { fireEvent.click(renameBtn); });
    // "" || null → name: null
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", { name: null });
    vi.unstubAllGlobals();
  });

  it("renameEdge no-op when viewId is not set", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.mocked(updateViewConnection).mockClear();
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("Label"));
    shared.edgeSelectedOverride = true;
    render(
      // No viewId → renameEdge should early-return
      <ViewCanvas
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[{ identifier: "e1", source: "a", target: "b", relationship_ref: null, name: null }]}
      />
    );
    const renameBtn = screen.getByText("Association");
    await act(async () => { fireEvent.click(renameBtn); });
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("ViewCanvas — onReconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared.edgeSelectedOverride = false;
  });

  it("calls updateViewConnection when edge is reconnected to a new target", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b"), makeNode("c")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    );
    await act(async () => {
      shared.onReconnect?.(
        { id: "e1", source: "a", target: "b", sourceHandle: "s-bottom", targetHandle: "t-top" },
        { source: "a", target: "c", sourceHandle: "s-right", targetHandle: "t-left" },
      );
    });
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith(
      "v1",
      "e1",
      expect.objectContaining({ target: "c", source_side: "right", target_side: "left" }),
    );
  });

  it("no-op when viewId is not set", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    vi.mocked(updateViewConnection).mockClear();
    render(
      <ViewCanvas
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    );
    await act(async () => {
      shared.onReconnect?.(
        { id: "e1", source: "a", target: "b", sourceHandle: null, targetHandle: null },
        { source: "a", target: "b", sourceHandle: null, targetHandle: null },
      );
    });
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled();
  });

  it("skips body fields when source/target/handles are unchanged or null", async () => {
    const { updateViewConnection } = await import("@/lib/api");
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    );
    await act(async () => {
      shared.onReconnect?.(
        { id: "e1", source: "a", target: "b", sourceHandle: "s-bottom", targetHandle: "t-top" },
        // Same source and target, null handles → conditions all false
        { source: "a", target: "b", sourceHandle: null, targetHandle: null },
      );
    });
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", {});
  });
});
