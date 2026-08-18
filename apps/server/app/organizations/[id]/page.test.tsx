import { render, screen } from "@testing-library/react"
import { vi, describe, expect, it } from "vitest"
import OrganizationDetailPage from "./page"

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
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
  useRenameOrganization: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOrganizationMembers: () => ({ data: [], isLoading: false }),
  useUpdateOrganizationMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveOrganizationMember: () => ({ mutateAsync: vi.fn() }),
  useOrganizationInvitations: () => ({ data: [] }),
  useCreateInvitation: () => ({ mutateAsync: vi.fn() }),
  useRevokeInvitation: () => ({ mutate: vi.fn(), isPending: false }),
  useResendInvitation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe("OrganizationDetailPage", () => {
  it("shows the edit form and member list, but not the platform-only suspend/delete actions", () => {
    render(<OrganizationDetailPage />)

    expect(screen.getByLabelText("settings.org.org_name")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "settings.org.members_title" })
    ).toBeInTheDocument()

    expect(
      screen.queryByText("platform.suspend")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("platform.reactivate")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("settings.org.delete_org_title")
    ).not.toBeInTheDocument()
  })
})
