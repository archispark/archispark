import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SidebarIconRail } from "./sidebar-icon-rail"

const { mockUseOrganizations } = vi.hoisted(() => ({
  mockUseOrganizations: vi.fn(() => ({ data: [{ id: "1", name: "Acme" }] })),
}))

vi.mock("@/lib/queries", () => ({
  useWorkspaces: () => ({ data: [] }),
  useOrganizations: mockUseOrganizations,
}))

vi.mock("@/components/sidebar-section", () => ({
  RailLink: ({ label }: { label: string }) => (
    <span data-testid="rail-link">{label}</span>
  ),
}))

vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <span />,
}))

vi.mock("@/components/workspace-switcher", () => ({
  WorkspaceSwitcher: () => <span data-testid="workspace-switcher" />,
}))

describe("SidebarIconRail", () => {
  it("keeps the same navigation order as the expanded sidebar", () => {
    render(
      <SidebarIconRail
        pathname="/"
        onClose={vi.fn()}
        collapsed
        absentCount={0}
        relConflictCount={0}
        t={(key) => key}
      />
    )

    expect(
      screen.getAllByTestId("rail-link").map((link) => link.textContent)
    ).toEqual([
      "sidebar.overview",
      "sidebar.dashboards",
      "sidebar.explore",
      "sidebar.panel_catalog",
      "sidebar.elements",
      "sidebar.relationships",
      "sidebar.views",
      "sidebar.properties",
      "sidebar.settings — sidebar.general",
    ])
  })

  it("hides every nav icon when the account has no organization", () => {
    mockUseOrganizations.mockReturnValueOnce({ data: [] })

    render(
      <SidebarIconRail
        pathname="/"
        onClose={vi.fn()}
        collapsed
        absentCount={0}
        relConflictCount={0}
        t={(key) => key}
      />
    )

    expect(screen.queryAllByTestId("rail-link")).toHaveLength(0)
    expect(screen.queryByTestId("workspace-switcher")).not.toBeInTheDocument()
  })

  it("points the logo link at the home page, not /workspaces", () => {
    render(
      <SidebarIconRail
        pathname="/"
        onClose={vi.fn()}
        collapsed
        absentCount={0}
        relConflictCount={0}
        t={(key) => key}
      />
    )

    expect(screen.getByRole("link", { name: "ArchiSpark" })).toHaveAttribute(
      "href",
      "/"
    )
  })
})
