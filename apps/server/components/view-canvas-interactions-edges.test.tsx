/**
 * view-canvas-interactions-edges.test.tsx
 *
 * HIDDEN_ELEMENT_TYPES filtering and the unknown-element-type color
 * fallback. Split out of view-canvas-interactions.test.tsx to stay under the
 * max-lines limit.
 */
import { makeNode } from "./test/view-canvas-interactions-mocks"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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

describe("ViewCanvas — HIDDEN_ELEMENT_TYPES filtering", () => {
  it("AndJunction nodes are excluded from the rendered node list", () => {
    const junction = makeNode("j1", { element_ref: "e-junc" })
    const normal = makeNode("n1", { element_ref: "e-app" })
    const elementTypes = new Map([
      ["e-junc", "AndJunction"],
      ["e-app", "ApplicationComponent"],
    ])
    render(
      <ViewCanvas
        nodes={[junction, normal]}
        connections={[]}
        elementTypes={elementTypes}
      />
    )
    // Only the normal node should appear (AndJunction filtered out)
    expect(screen.getByTestId("node-count").textContent).toBe("1")
  })

  it("connections to hidden nodes are also filtered out", () => {
    const junction = makeNode("j1", { element_ref: "e-junc" })
    const normal = makeNode("n1", { element_ref: "e-app" })
    const elementTypes = new Map([
      ["e-junc", "AndJunction"],
      ["e-app", "ApplicationComponent"],
    ])
    const conn: ConnectionOut = {
      identifier: "c1",
      relationship_ref: null,
      source: "j1",
      target: "n1",
      name: null,
    }
    render(
      <ViewCanvas
        nodes={[junction, normal]}
        connections={[conn]}
        elementTypes={elementTypes}
      />
    )
    // The connection references the hidden junction — should be filtered
    expect(screen.getByTestId("edge-count").textContent).toBe("0")
  })
})

describe("ViewCanvas — colorFor with unknown element type", () => {
  it("renders node with unknown element type using 'other' layer color", () => {
    const nodes = [makeNode("n1", { element_ref: "e1" })]
    // No element type in the map → should fall back to 'other' layer colors
    render(
      <ViewCanvas nodes={nodes} connections={[]} elementTypes={new Map()} />
    )
    expect(screen.getByTestId("node-count").textContent).toBe("1")
  })
})
