import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    proOptions,
  }: {
    children?: ReactNode
    proOptions?: { hideAttribution?: boolean }
  }) => (
    <div
      data-testid="reactflow-shell"
      data-hide-attribution={String(proOptions?.hideAttribution)}
    >
      {children}
    </div>
  ),
  Background: () => <div data-testid="reactflow-background" />,
  Controls: () => <div data-testid="reactflow-controls" />,
}))

import { ArchisparkReactFlow } from "./archispark-react-flow"

describe("ArchisparkReactFlow", () => {
  it("provides the shared canvas chrome", () => {
    render(
      <ArchisparkReactFlow nodes={[]} edges={[]}>
        <div>Feature panel</div>
      </ArchisparkReactFlow>
    )

    expect(screen.getByTestId("reactflow-background")).toBeInTheDocument()
    expect(screen.getByTestId("reactflow-controls")).toBeInTheDocument()
    expect(screen.getByText("Feature panel")).toBeInTheDocument()
    expect(screen.getByTestId("reactflow-shell")).toHaveAttribute(
      "data-hide-attribution",
      "true"
    )
  })
})
