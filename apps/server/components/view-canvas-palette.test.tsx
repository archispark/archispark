import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ViewCanvas } from "./view-canvas"
import { makeElement, renderWithI18n } from "./test/view-canvas-mocks"

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

describe("ViewCanvas — ElementPalette", () => {
  it("renders ElementPalette with elements when viewId provided", () => {
    const elements = [makeElement("e1", "My App", "ApplicationComponent")]
    render(
      <ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />
    )
    expect(screen.getByText("My App")).toBeInTheDocument()
  })

  it("shows 'no element' message when empty", () => {
    render(<ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={[]} />)
    expect(screen.getByText("Aucun élément.")).toBeInTheDocument()
  })

  it("collapse/expand all buttons work", () => {
    const elements = [
      makeElement("e1", "App A", "ApplicationComponent"),
      makeElement("e2", "App B", "ApplicationComponent"),
    ]
    renderWithI18n(
      <ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />
    )
    const collapseBtn = screen.getByTitle("Tout replier")
    const expandBtn = screen.getByTitle("Tout déplier")
    fireEvent.click(collapseBtn)
    fireEvent.click(expandBtn)
    expect(screen.getByText("App A")).toBeInTheDocument()
  })

  it("toggle type group collapses and expands", () => {
    const elements = [makeElement("e1", "App A", "ApplicationComponent")]
    render(
      <ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />
    )
    const typeHeader = screen.getByText("ApplicationComponent")
    fireEvent.click(typeHeader.closest("button")!)
    fireEvent.click(typeHeader.closest("button")!)
    expect(screen.getByText("ApplicationComponent")).toBeInTheDocument()
  })

  it("search filters elements", () => {
    const elements = [
      makeElement("e1", "AppServer", "ApplicationComponent"),
      makeElement("e2", "Database", "DataObject"),
    ]
    renderWithI18n(
      <ViewCanvas viewId="v1" nodes={[]} connections={[]} elements={elements} />
    )
    const input = screen.getByPlaceholderText("Rechercher élément…")
    fireEvent.change(input, { target: { value: "App" } })
    expect(screen.getByText("AppServer")).toBeInTheDocument()
  })
})
