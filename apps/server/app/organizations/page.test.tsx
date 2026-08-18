import { render, screen } from "@testing-library/react"
import { vi, describe, expect, it } from "vitest"
import OrganizationsPage from "./page"

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("@/lib/queries", () => ({
  useOrganizations: () => ({
    data: [
      {
        id: "1",
        slug: "archi",
        name: "Archi",
        is_personal: false,
        enabled: true,
        role: "owner",
        active: true,
      },
    ],
    isLoading: false,
  }),
  useActivateOrganization: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe("OrganizationsPage", () => {
  it("links the organization name to its detail page instead of exposing row action buttons", () => {
    render(<OrganizationsPage />)

    const link = screen.getByRole("link", { name: /Archi/ })
    expect(link).toHaveAttribute("href", "/organizations/1")

    expect(
      screen.queryByRole("button", { name: "settings.org.members_title" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "common.edit" })
    ).not.toBeInTheDocument()
  })
})
