import { render, screen } from "@testing-library/react"
import { vi, describe, expect, it } from "vitest"
import HomePage from "./page"

const { mockUseOrganizations } = vi.hoisted(() => ({
  mockUseOrganizations: vi.fn(),
}))

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("@/lib/queries", () => ({
  useOrganizations: mockUseOrganizations,
}))

describe("HomePage", () => {
  it("shows the no-organization empty state instead of a create-organization action", () => {
    mockUseOrganizations.mockReturnValue({ data: [], isLoading: false })
    render(<HomePage />)

    expect(screen.getByText("home.no_org_title")).toBeInTheDocument()
    expect(screen.getByText("home.no_org_desc")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /créer|create/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /créer|create/i })
    ).not.toBeInTheDocument()
  })

  it("shows a welcome message with quick links when the account has an organization", () => {
    mockUseOrganizations.mockReturnValue({
      data: [{ id: "1", name: "Acme" }],
      isLoading: false,
    })
    render(<HomePage />)

    expect(screen.getByText("home.welcome_title")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "sidebar.overview" })).toHaveAttribute(
      "href",
      "/overview"
    )
    expect(
      screen.getByRole("link", { name: "breadcrumb.workspaces" })
    ).toHaveAttribute("href", "/workspaces")
  })
})
