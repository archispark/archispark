import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SidebarNavContent } from "./sidebar-nav-content"

const { mockUseOrganizations } = vi.hoisted(() => ({
  mockUseOrganizations: vi.fn(() => ({ data: [{ id: "1", name: "Acme" }] })),
}))

vi.mock("@/lib/queries", () => ({
  useWorkspaces: () => ({ data: [] }),
  useOrganizations: mockUseOrganizations,
}))

vi.mock("@/components/sidebar-elements-nav", () => ({
  ElementsNavSection: () => <div data-testid="elements-nav" />,
}))

vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <span />,
}))

vi.mock("@/components/workspace-switcher", () => ({
  WorkspaceSwitcher: () => <span data-testid="workspace-switcher" />,
}))

const t = (key: string) => key

describe("SidebarNavContent", () => {
  it("shows the nav sections when the account has an organization", () => {
    render(
      <SidebarNavContent pathname="/overview" onClose={vi.fn()} t={t} />
    )

    expect(screen.getByText("sidebar.overview")).toBeInTheDocument()
    expect(screen.getByTestId("elements-nav")).toBeInTheDocument()
  })

  it("hides every nav section when the account has no organization", () => {
    mockUseOrganizations.mockReturnValueOnce({ data: [] })

    render(
      <SidebarNavContent pathname="/" onClose={vi.fn()} t={t} />
    )

    expect(screen.queryByText("sidebar.overview")).not.toBeInTheDocument()
    expect(screen.queryByTestId("elements-nav")).not.toBeInTheDocument()
    expect(screen.queryByTestId("workspace-switcher")).not.toBeInTheDocument()
  })

  it("points the logo link at the home page, not /workspaces", () => {
    render(
      <SidebarNavContent pathname="/overview" onClose={vi.fn()} t={t} />
    )

    expect(screen.getByRole("link", { name: /ArchiSpark/ })).toHaveAttribute(
      "href",
      "/"
    )
  })
})
