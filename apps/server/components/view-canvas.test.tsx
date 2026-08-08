import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ViewCanvas } from "./view-canvas"
import type { ConnectionOut } from "@/lib/api"
import { makeNode, makeEdge } from "./test/view-canvas-mocks"

vi.mock("@workspace/ui/components/dialog", () =>
  import("./test/view-canvas-mocks").then((m) => m.dialogMock)
)
vi.mock("@workspace/ui/components/button", () =>
  import("./test/view-canvas-mocks").then((m) => m.buttonMock)
)
vi.mock("@xyflow/react", () =>
  import("./test/view-canvas-mocks").then((m) => m.reactFlowMock)
)
vi.mock("html-to-image", () =>
  import("./test/view-canvas-mocks").then((m) => m.htmlToImageMock)
)

describe("ViewCanvas", () => {
  it("renders reactflow container", () => {
    render(<ViewCanvas nodes={[]} connections={[]} />)
    expect(screen.getByTestId("reactflow")).toBeInTheDocument()
  })

  it("maps flat nodes correctly", () => {
    const nodes = [makeNode("n1"), makeNode("n2")]
    render(<ViewCanvas nodes={nodes} connections={[]} />)
    expect(screen.getByTestId("node-count").textContent).toBe("2")
    expect(screen.getByTestId("edge-count").textContent).toBe("0")
  })

  it("flattens nested nodes", () => {
    const child = makeNode("child")
    const parent = makeNode("parent", { children: [child] })
    render(<ViewCanvas nodes={[parent]} connections={[]} />)
    expect(screen.getByTestId("node-count").textContent).toBe("2")
  })

  it("maps connections to edges", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    const connections = [makeEdge("e1", "a", "b")]
    render(<ViewCanvas nodes={nodes} connections={connections} />)
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })

  it("handles deeply nested nodes", () => {
    const grandchild = makeNode("gc")
    const child = makeNode("c", { children: [grandchild] })
    const root = makeNode("r", { children: [child] })
    render(<ViewCanvas nodes={[root]} connections={[]} />)
    expect(screen.getByTestId("node-count").textContent).toBe("3")
  })

  it("converts absolute model coordinates to parent-relative React Flow positions", () => {
    // Model coords are absolute. A child at (180,144) inside a parent at
    // (144,96) must render at the relative offset (36,48); a grandchild at
    // (233,252) inside that child must be relative to the child, not the root.
    const grandchild = makeNode("gc", { x: 233, y: 252 })
    const child = makeNode("child", { x: 180, y: 144, children: [grandchild] })
    const parent = makeNode("parent", { x: 144, y: 96, children: [child] })
    render(<ViewCanvas nodes={[parent]} connections={[]} />)

    const parentEl = screen.getByTestId("node-parent")
    expect(parentEl.getAttribute("data-x")).toBe("144")
    expect(parentEl.getAttribute("data-y")).toBe("96")
    expect(parentEl.getAttribute("data-parent")).toBe("")

    const childEl = screen.getByTestId("node-child")
    expect(childEl.getAttribute("data-x")).toBe("36") // 180 - 144
    expect(childEl.getAttribute("data-y")).toBe("48") // 144 - 96
    expect(childEl.getAttribute("data-parent")).toBe("parent")

    const gcEl = screen.getByTestId("node-gc")
    expect(gcEl.getAttribute("data-x")).toBe("53") // 233 - 180
    expect(gcEl.getAttribute("data-y")).toBe("108") // 252 - 144
    expect(gcEl.getAttribute("data-parent")).toBe("child")
  })

  it("renders ArchiMate type-icon primitives for nodes with known element types", () => {
    const nodes = [
      makeNode("p", { element_ref: "e-process" }), // polygon glyph
      makeNode("c", { element_ref: "e-collab" }), // circle glyph
      makeNode("cap", { element_ref: "e-cap" }), // rect glyph
      makeNode("art", { element_ref: "e-art" }), // path glyph
      makeNode("gap", { element_ref: "e-gap" }), // ellipse glyph
    ]
    const elementTypes = new Map([
      ["e-process", "BusinessProcess"],
      ["e-collab", "BusinessCollaboration"],
      ["e-cap", "Capability"],
      ["e-art", "Artifact"],
      ["e-gap", "Gap"],
    ])
    render(
      <ViewCanvas nodes={nodes} connections={[]} elementTypes={elementTypes} />
    )
    expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("circle").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("ellipse").length).toBeGreaterThan(0)
    expect(document.querySelectorAll("path").length).toBeGreaterThan(0)
  })

  it("offers PNG and SVG canvas downloads from a single menu", () => {
    render(<ViewCanvas viewId="v1" nodes={[makeNode("n1")]} connections={[]} />)
    const trigger = screen.getByRole("button", { name: /Télécharger/ })
    // Menu items are hidden until the menu is opened.
    expect(screen.queryByRole("menuitem", { name: "PNG" })).toBeNull()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: "PNG" })) // closes after choosing

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: "SVG" }))
  })

  it("maps connections with relationship type from map", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    const connections = [makeEdge("e1", "a", "b", "rel-1")]
    const relTypes = new Map([["rel-1", "Composition"]])
    render(
      <ViewCanvas
        nodes={nodes}
        connections={connections}
        relationshipTypes={relTypes}
      />
    )
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })

  it("uses elementNames map to label nodes", () => {
    const nodes = [makeNode("n1", { element_ref: "e1", name: null })]
    const elementNames = new Map([["e1", "My App"]])
    render(
      <ViewCanvas nodes={nodes} connections={[]} elementNames={elementNames} />
    )
    expect(screen.getByTestId("node-count").textContent).toBe("1")
  })

  it("picks handles based on node positions (horizontal layout)", () => {
    const nodeLeft = makeNode("a", { x: 0, y: 0, w: 100, h: 60 })
    const nodeRight = makeNode("b", { x: 200, y: 0, w: 100, h: 60 })
    const connections = [makeEdge("e1", "a", "b")]
    render(
      <ViewCanvas nodes={[nodeLeft, nodeRight]} connections={connections} />
    )
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })

  it("picks handles based on node positions (vertical layout)", () => {
    const nodeTop = makeNode("a", { x: 0, y: 0, w: 100, h: 60 })
    const nodeBottom = makeNode("b", { x: 0, y: 200, w: 100, h: 60 })
    const connections = [makeEdge("e1", "a", "b")]
    render(
      <ViewCanvas nodes={[nodeTop, nodeBottom]} connections={connections} />
    )
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })

  it("uses source_side and target_side from connection", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    const conn: ConnectionOut = {
      identifier: "c1",
      source: "a",
      target: "b",
      relationship_ref: null,
      name: "labeled",
      source_side: "top",
      target_side: "bottom",
    }
    render(<ViewCanvas nodes={nodes} connections={[conn]} />)
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })

  it("handles connection with null source/target gracefully", () => {
    const conn: ConnectionOut = {
      identifier: "c1",
      source: null,
      target: null,
      relationship_ref: null,
      name: null,
    }
    render(<ViewCanvas nodes={[]} connections={[conn]} />)
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })

  it("renders ArchiNode with hasChildren=true for parent nodes", () => {
    const child = makeNode("child")
    const parent = makeNode("parent", { children: [child] })
    render(<ViewCanvas viewId="v1" nodes={[parent]} connections={[]} />)
    expect(screen.getByTestId("node-count").textContent).toBe("2")
  })

  it("renders nodes with element_ref and elementTypes map", () => {
    const node = makeNode("n1", { element_ref: "e1", name: null })
    const elementTypes = new Map([["e1", "ApplicationComponent"]])
    render(
      <ViewCanvas nodes={[node]} connections={[]} elementTypes={elementTypes} />
    )
    expect(screen.getByTestId("node-count").textContent).toBe("1")
  })

  it("covers different archimateEdgeStyle cases via relType", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    const relTypes = [
      "Triggering",
      "Flow",
      "Realization",
      "Specialization",
      "Access",
      "Influence",
      "Composition",
      "Aggregation",
      "Assignment",
      "Serving",
      "UsedBy",
    ]
    for (const relType of relTypes) {
      const relTypesMap = new Map([["rel-1", relType]])
      const { unmount } = render(
        <ViewCanvas
          nodes={nodes}
          connections={[makeEdge("e1", "a", "b", "rel-1")]}
          relationshipTypes={relTypesMap}
        />
      )
      expect(screen.getByTestId("edge-count").textContent).toBe("1")
      unmount()
    }
  })

  it("renders edges with relationship name label", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    const conn = makeEdge("e1", "a", "b", "rel-1")
    const relNames = new Map([["rel-1", "triggers"]])
    render(
      <ViewCanvas
        nodes={nodes}
        connections={[conn]}
        relationshipNames={relNames}
      />
    )
    expect(screen.getByTestId("edge-count").textContent).toBe("1")
  })
})
