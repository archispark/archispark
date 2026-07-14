/**
 * view-canvas-interactions-nodes.test.tsx
 *
 * Node/edge drag, delete, double-click-rename, drop-to-create and palette
 * drag-start interactions. Split out of view-canvas-interactions.test.tsx to
 * stay under the max-lines limit.
 */
import {
  shared,
  makeNode,
  makeEdge,
  makeElement,
} from "./test/view-canvas-interactions-mocks"
import { describe, it, expect, vi } from "vitest"
import {
  render,
  screen,
  fireEvent,
  act,
  createEvent,
} from "@testing-library/react"
import { ViewCanvas } from "./view-canvas"

vi.mock("@workspace/ui/components/dialog", () =>
  import("./test/view-canvas-interactions-mocks").then((m) => m.dialogMock)
)
vi.mock("@workspace/ui/components/button", () =>
  import("./test/view-canvas-interactions-mocks").then((m) => m.buttonMock)
)
vi.mock("@/lib/api", () =>
  import("./test/view-canvas-interactions-mocks").then((m) => m.apiMock)
)
vi.mock("html-to-image", () =>
  import("./test/view-canvas-interactions-mocks").then((m) => m.htmlToImageMock)
)
vi.mock("@xyflow/react", () =>
  import("./test/view-canvas-interactions-reactflow-mock").then((m) => m.reactFlowMock)
)

describe("ViewCanvas — onNodeDragStop", () => {
  it("calls updateViewNode after node drag", async () => {
    const { updateViewNode } = await import("@/lib/api")
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />)
    await act(async () => {
      shared.onNodeDragStop?.({}, { id: "n1", position: { x: 50, y: 80 } })
    })
    expect(vi.mocked(updateViewNode)).toHaveBeenCalledWith(
      "v1",
      "n1",
      expect.objectContaining({ x: 50, y: 80 })
    )
  })

  it("no-op when viewId is not set", async () => {
    const { updateViewNode } = await import("@/lib/api")
    vi.mocked(updateViewNode).mockClear()
    render(<ViewCanvas nodes={[makeNode("n1")]} connections={[]} />)
    await act(async () => {
      shared.onNodeDragStop?.({}, { id: "n1", position: { x: 50, y: 80 } })
    })
    expect(vi.mocked(updateViewNode)).not.toHaveBeenCalled()
  })
})

describe("ViewCanvas — onNodesDelete", () => {
  it("calls deleteViewNode for each deleted node", async () => {
    const { deleteViewNode } = await import("@/lib/api")
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />)
    await act(async () => {
      shared.onNodesDelete?.([{ id: "n1" }])
    })
    expect(vi.mocked(deleteViewNode)).toHaveBeenCalledWith("v1", "n1")
  })
})

describe("ViewCanvas — onEdgesDelete", () => {
  it("calls deleteViewConnection for each deleted edge", async () => {
    const { deleteViewConnection } = await import("@/lib/api")
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    )
    await act(async () => {
      shared.onEdgesDelete?.([{ id: "e1" }])
    })
    expect(vi.mocked(deleteViewConnection)).toHaveBeenCalledWith("v1", "e1")
  })
})

describe("ViewCanvas — onNodeDoubleClick", () => {
  it("calls updateViewNode after renaming via prompt", async () => {
    const { updateViewNode } = await import("@/lib/api")
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("New Label"))
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />)
    await act(async () => {
      shared.onNodeDoubleClick?.({}, { id: "n1", data: { label: "n1" } })
    })
    expect(vi.mocked(updateViewNode)).toHaveBeenCalledWith("v1", "n1", {
      name: "New Label",
    })
    vi.unstubAllGlobals()
  })

  it("no-op when prompt returns null (user cancels)", async () => {
    const { updateViewNode } = await import("@/lib/api")
    vi.mocked(updateViewNode).mockClear()
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null))
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />)
    await act(async () => {
      shared.onNodeDoubleClick?.({}, { id: "n1", data: { label: "n1" } })
    })
    expect(vi.mocked(updateViewNode)).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe("ViewCanvas — onEdgeDoubleClick", () => {
  it("calls updateViewConnection after renaming edge via prompt", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("Renamed"))
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    )
    await act(async () => {
      shared.onEdgeDoubleClick?.({}, { id: "e1", label: "" })
    })
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", {
      name: "Renamed",
    })
    vi.unstubAllGlobals()
  })

  it("no-op when prompt returns null", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.mocked(updateViewConnection).mockClear()
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null))
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} />)
    await act(async () => {
      shared.onEdgeDoubleClick?.({}, { id: "e1", label: "" })
    })
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe("ViewCanvas — onDrop", () => {
  it("calls createViewNode when element dragged onto canvas", async () => {
    const { createViewNode } = await import("@/lib/api")
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} />)
    // The drop target is the div wrapping ReactFlow (parent of data-testid="reactflow")
    const dropZone = screen.getByTestId("reactflow").parentElement!
    const dropEvent = createEvent.drop(dropZone)
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        getData: vi.fn().mockReturnValue("e1"),
        types: ["application/x-archi-element"],
      },
    })
    Object.defineProperty(dropEvent, "clientX", { value: 200 })
    Object.defineProperty(dropEvent, "clientY", { value: 150 })
    await act(async () => {
      fireEvent(dropZone, dropEvent)
    })
    expect(vi.mocked(createViewNode)).toHaveBeenCalled()
  })

  it("no-op when no viewId is set", async () => {
    const { createViewNode } = await import("@/lib/api")
    vi.mocked(createViewNode).mockClear()
    render(<ViewCanvas nodes={[]} connections={[]} />)
    const reactflowEl = screen.getByTestId("reactflow")
    // Find a parent div to drop on
    const dropZone = reactflowEl.parentElement ?? reactflowEl
    const dropEvent = createEvent.drop(dropZone)
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        getData: vi.fn().mockReturnValue("e1"),
        types: ["application/x-archi-element"],
      },
    })
    await act(async () => {
      fireEvent(dropZone, dropEvent)
    })
    expect(vi.mocked(createViewNode)).not.toHaveBeenCalled()
  })
})

describe("ViewCanvas — ElementPalette onDragStart", () => {
  it("sets drag data when dragging an element from palette", () => {
    const elements = [makeElement("e1", "My App", "ApplicationComponent")]
    render(
      <ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />
    )
    const draggable = screen.getByTitle("ApplicationComponent — My App")
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
    }
    fireEvent.dragStart(draggable, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-archi-element",
      "e1"
    )
    expect(dataTransfer.effectAllowed).toBe("move")
  })
})
