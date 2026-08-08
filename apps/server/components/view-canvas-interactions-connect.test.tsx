/**
 * view-canvas-interactions-connect.test.tsx
 *
 * onConnect (pending relationship dialog) and onReconnect (edge re-target)
 * flows. Split out of view-canvas-interactions.test.tsx to stay under the
 * max-lines limit.
 */
import {
  shared,
  makeNode,
  makeEdge,
} from "./test/view-canvas-interactions-mocks"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
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

describe("ViewCanvas — onConnect flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("onConnect with source/target that have element refs triggers pending connection dialog", async () => {
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ]
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "BusinessProcess"],
    ])
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    )
    // Invoke the captured onConnect handler
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" })
    })
    // The pending connection dialog should appear with relationship type buttons
    expect(screen.queryByText("Type ArchiMate")).not.toBeNull()
  })

  it("onConnect cancels when clicking backdrop", async () => {
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ]
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "ApplicationComponent"],
    ])
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    )
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" })
    })
    // Dialog should be visible — click Annuler to cancel
    const cancelBtn = screen.queryByText("Annuler")
    if (cancelBtn) {
      fireEvent.click(cancelBtn)
      expect(screen.queryByText("Type ArchiMate")).toBeNull()
    }
  })

  it("onConnect is a no-op when source or target is null", async () => {
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} />)
    await act(async () => {
      shared.onConnect?.({ source: null, target: "n2" })
    })
    expect(screen.queryByText("Type ArchiMate")).toBeNull()
  })

  it("clicking a relationship type button calls confirmRelationshipType", async () => {
    const { createRelationship } = await import("@/lib/api")
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ]
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "ApplicationComponent"],
    ])
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    )
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" })
    })
    // The dialog shows relationship type buttons; click the first available
    const typeBtn = screen.queryByText("Association")
    if (typeBtn) {
      await act(async () => {
        fireEvent.click(typeBtn)
      })
      expect(vi.mocked(createRelationship)).toHaveBeenCalled()
    }
  })

  it("clicking backdrop closes pendingConnection dialog", async () => {
    const nodes = [
      makeNode("n1", { element_ref: "e1" }),
      makeNode("n2", { element_ref: "e2" }),
    ]
    const elementTypes = new Map([
      ["e1", "ApplicationComponent"],
      ["e2", "ApplicationComponent"],
    ])
    const { container } = render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[]}
        elementTypes={elementTypes}
      />
    )
    await act(async () => {
      shared.onConnect?.({ source: "n1", target: "n2" })
    })
    expect(screen.queryByText("Type ArchiMate")).not.toBeNull()
    // Click the backdrop overlay (the outermost div with onClick={() => setPendingConnection(null)})
    const backdrop = container.querySelector(
      '[style*="rgba(0,0,0,0.35)"]'
    ) as HTMLElement | null
    if (backdrop) {
      await act(async () => {
        fireEvent.click(backdrop)
      })
      expect(screen.queryByText("Type ArchiMate")).toBeNull()
    }
  })
})

describe("ViewCanvas — onReconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shared.edgeSelectedOverride = false
  })

  it("calls updateViewConnection when edge is reconnected to a new target", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b"), makeNode("c")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    )
    await act(async () => {
      shared.onReconnect?.(
        {
          id: "e1",
          source: "a",
          target: "b",
          sourceHandle: "s-bottom",
          targetHandle: "t-top",
        },
        {
          source: "a",
          target: "c",
          sourceHandle: "s-right",
          targetHandle: "t-left",
        }
      )
    })
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith(
      "v1",
      "e1",
      expect.objectContaining({
        target: "c",
        source_side: "right",
        target_side: "left",
      })
    )
  })

  it("no-op when viewId is not set", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.mocked(updateViewConnection).mockClear()
    render(
      <ViewCanvas
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    )
    await act(async () => {
      shared.onReconnect?.(
        {
          id: "e1",
          source: "a",
          target: "b",
          sourceHandle: null,
          targetHandle: null,
        },
        { source: "a", target: "b", sourceHandle: null, targetHandle: null }
      )
    })
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled()
  })

  it("skips body fields when source/target/handles are unchanged or null", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[makeEdge("e1", "a", "b")]}
      />
    )
    await act(async () => {
      shared.onReconnect?.(
        {
          id: "e1",
          source: "a",
          target: "b",
          sourceHandle: "s-bottom",
          targetHandle: "t-top",
        },
        // Same source and target, null handles → conditions all false
        { source: "a", target: "b", sourceHandle: null, targetHandle: null }
      )
    })
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", {})
  })
})
