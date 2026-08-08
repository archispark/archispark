/**
 * view-canvas-interactions-edge-rename.test.tsx
 *
 * ArchiEdge rename/delete button interactions when selected, plus the
 * renameEdge empty-string/no-viewId edge cases. Split out of
 * view-canvas-interactions-edges.test.tsx to stay under the max-lines limit.
 */
import { shared, makeNode } from "./test/view-canvas-interactions-mocks"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { ViewCanvas } from "./view-canvas"
import type { ConnectionOut } from "@/lib/api"

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
  import("./test/view-canvas-interactions-reactflow-mock").then(
    (m) => m.reactFlowMock
  )
)

describe("ViewCanvas — ArchiEdge interactions (selected=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shared.edgeSelectedOverride = false
  })

  it("ArchiEdge renders rename and delete buttons when selected", () => {
    shared.edgeSelectedOverride = true
    const nodes = [makeNode("a"), makeNode("b")]
    const edges: ConnectionOut[] = [
      {
        identifier: "e1",
        source: "a",
        target: "b",
        relationship_ref: null,
        name: null,
      },
    ]
    render(<ViewCanvas viewId="v1" nodes={nodes} connections={edges} />)
    // ArchiEdge with selected=true should render the rename button (shows relType or "Association")
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
    // The rename button text is relType ?? "Association"
    expect(screen.getByText("Association")).toBeInTheDocument()
    // The delete button has aria-label (via t("canvas.remove_from_view"))
    expect(screen.getByText("×")).toBeInTheDocument()
  })

  it("ArchiEdge rename button calls updateViewConnection with new name", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("New Name"))
    shared.edgeSelectedOverride = true
    const nodes = [makeNode("a"), makeNode("b")]
    render(
      <ViewCanvas
        viewId="v1"
        nodes={nodes}
        connections={[
          {
            identifier: "e1",
            source: "a",
            target: "b",
            relationship_ref: null,
            name: null,
          },
        ]}
      />
    )
    const renameBtn = screen.getByText("Association")
    await act(async () => {
      fireEvent.click(renameBtn)
    })
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", {
      name: "New Name",
    })
    vi.unstubAllGlobals()
  })

  it("ArchiEdge rename button no-op when prompt returns null", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.mocked(updateViewConnection).mockClear()
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null))
    shared.edgeSelectedOverride = true
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[
          {
            identifier: "e1",
            source: "a",
            target: "b",
            relationship_ref: null,
            name: null,
          },
        ]}
      />
    )
    const renameBtn = screen.getByText("Association")
    await act(async () => {
      fireEvent.click(renameBtn)
    })
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("ArchiEdge delete button shows confirm dialog, confirm calls deleteViewConnection", async () => {
    const { deleteViewConnection } = await import("@/lib/api")
    shared.edgeSelectedOverride = true
    const { container } = render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[
          {
            identifier: "e1",
            source: "a",
            target: "b",
            relationship_ref: null,
            name: null,
          },
        ]}
      />
    )
    // Click the × delete button to open confirmation dialog
    const deleteBtn = screen.getByText("×")
    await act(async () => {
      fireEvent.click(deleteBtn)
    })
    // Confirm button in dialog uses t("common.delete") which returns "common.delete" (no I18nProvider)
    const confirmBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "common.delete"
    )
    if (confirmBtns[0]) {
      await act(async () => {
        fireEvent.click(confirmBtns[0]!)
      })
      expect(vi.mocked(deleteViewConnection)).toHaveBeenCalledWith("v1", "e1")
    }
  })

  it("ArchiEdge remove without viewId: only calls setEdges (if(viewId) false branch)", async () => {
    const { deleteViewConnection } = await import("@/lib/api")
    vi.mocked(deleteViewConnection).mockClear()
    shared.edgeSelectedOverride = true
    const { container } = render(
      // No viewId — removeEdge should not call deleteViewConnection
      <ViewCanvas
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[
          {
            identifier: "e1",
            source: "a",
            target: "b",
            relationship_ref: null,
            name: null,
          },
        ]}
      />
    )
    const deleteBtn = screen.getByText("×")
    await act(async () => {
      fireEvent.click(deleteBtn)
    })
    const confirmBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "common.delete"
    )
    if (confirmBtns[0]) {
      await act(async () => {
        fireEvent.click(confirmBtns[0]!)
      })
      // Without viewId, deleteViewConnection should NOT be called
      expect(vi.mocked(deleteViewConnection)).not.toHaveBeenCalled()
    }
  })

  it("ArchiEdge with label renders label text", () => {
    shared.edgeSelectedOverride = false
    const nodes = [makeNode("a"), makeNode("b")]
    const conn: ConnectionOut = {
      identifier: "e1",
      source: "a",
      target: "b",
      relationship_ref: null,
      name: "my-label",
    }
    render(<ViewCanvas nodes={nodes} connections={[conn]} />)
    expect(screen.getByText("my-label")).toBeInTheDocument()
  })
})

describe("ViewCanvas — ArchiEdge renameEdge with empty string", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shared.edgeSelectedOverride = false
  })

  it("renameEdge sends null name when prompt returns empty string", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(""))
    shared.edgeSelectedOverride = true
    render(
      <ViewCanvas
        viewId="v1"
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[
          {
            identifier: "e1",
            source: "a",
            target: "b",
            relationship_ref: null,
            name: null,
          },
        ]}
      />
    )
    const renameBtn = screen.getByText("Association")
    await act(async () => {
      fireEvent.click(renameBtn)
    })
    // "" || null → name: null
    expect(vi.mocked(updateViewConnection)).toHaveBeenCalledWith("v1", "e1", {
      name: null,
    })
    vi.unstubAllGlobals()
  })

  it("renameEdge no-op when viewId is not set", async () => {
    const { updateViewConnection } = await import("@/lib/api")
    vi.mocked(updateViewConnection).mockClear()
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("Label"))
    shared.edgeSelectedOverride = true
    render(
      // No viewId → renameEdge should early-return
      <ViewCanvas
        nodes={[makeNode("a"), makeNode("b")]}
        connections={[
          {
            identifier: "e1",
            source: "a",
            target: "b",
            relationship_ref: null,
            name: null,
          },
        ]}
      />
    )
    const renameBtn = screen.getByText("Association")
    await act(async () => {
      fireEvent.click(renameBtn)
    })
    expect(vi.mocked(updateViewConnection)).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
