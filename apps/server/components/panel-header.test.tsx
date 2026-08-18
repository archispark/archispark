import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PanelHeader } from "./panel-header"

const {
  mockUsePathname,
  mockPush,
  mockUseWorkspaces,
  mockUseOrganizations,
  mockUsePlatformOrganization,
} = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockPush: vi.fn(),
  mockUseWorkspaces: vi.fn(),
  mockUseOrganizations: vi.fn(),
  mockUsePlatformOrganization: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("@/lib/queries", () => ({
  useWorkspaces: mockUseWorkspaces,
  useOrganizations: mockUseOrganizations,
  useElement: () => ({ data: undefined }),
  useView: () => ({ data: undefined }),
  usePlatformUser: () => ({ data: undefined }),
  usePlatformOrganization: mockUsePlatformOrganization,
}))

vi.mock("@/lib/queries/dashboards", () => ({
  useDashboard: () => ({ data: undefined }),
}))

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

mockUsePlatformOrganization.mockReturnValue({ data: undefined })

function renderPanelHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PanelHeader
        showSidebarToggle={false}
        sidebarCollapsed={false}
        onToggleSidebar={() => {}}
        onToggleMobileSidebar={() => {}}
      />
    </QueryClientProvider>
  )
}

describe("PanelHeader — zero-workspaces redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWorkspaces.mockReturnValue({ data: [], isSuccess: true })
    mockUseOrganizations.mockReturnValue({
      data: [{ id: "1", name: "Acme" }],
      isSuccess: true,
    })
  })

  it("redirects to /workspaces when the organization has no workspace yet", () => {
    mockUsePathname.mockReturnValue("/dashboards")
    renderPanelHeader()
    expect(mockPush).toHaveBeenCalledWith("/workspaces")
  })

  it("does not redirect away from /platform/organizations — a platform_admin with no real organization membership has zero workspaces by design", () => {
    mockUseOrganizations.mockReturnValue({ data: [], isSuccess: true })
    mockUsePathname.mockReturnValue("/platform/organizations")
    renderPanelHeader()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("does not redirect away from /platform/settings", () => {
    mockUsePathname.mockReturnValue("/platform/settings")
    renderPanelHeader()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("does not redirect when already on /workspaces", () => {
    mockUsePathname.mockReturnValue("/workspaces")
    renderPanelHeader()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("does not redirect once the workspace list is non-empty", () => {
    mockUseWorkspaces.mockReturnValue({
      data: [{ id: "1", name: "Main" }],
      isSuccess: true,
    })
    mockUsePathname.mockReturnValue("/dashboards")
    renderPanelHeader()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe("PanelHeader — zero-organizations redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWorkspaces.mockReturnValue({ data: [], isSuccess: true })
    mockUseOrganizations.mockReturnValue({ data: [], isSuccess: true })
  })

  it("redirects to / rather than /workspaces — users can no longer self-provision an organization there", () => {
    mockUsePathname.mockReturnValue("/workspaces")
    renderPanelHeader()
    expect(mockPush).toHaveBeenCalledWith("/")
  })

  it("redirects to / from any other route", () => {
    mockUsePathname.mockReturnValue("/dashboards")
    renderPanelHeader()
    expect(mockPush).toHaveBeenCalledWith("/")
  })

  it("does not redirect when already on /", () => {
    mockUsePathname.mockReturnValue("/")
    renderPanelHeader()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("does not redirect away from /platform/**", () => {
    mockUsePathname.mockReturnValue("/platform/organizations")
    renderPanelHeader()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe("PanelHeader — organization breadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWorkspaces.mockReturnValue({
      data: [{ id: "1", name: "Main" }],
      isSuccess: true,
    })
    mockUseOrganizations.mockReturnValue({
      data: [{ id: "1", name: "Acme" }],
      isSuccess: true,
    })
  })

  it("shows the organization name instead of its id", () => {
    mockUsePathname.mockReturnValue("/organizations/1")
    renderPanelHeader()
    expect(screen.getByText("Acme")).toBeInTheDocument()
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })

  it("shows the organization name instead of its id on the platform_admin route", () => {
    mockUsePlatformOrganization.mockReturnValue({
      data: { id: "1", name: "Acme" },
    })
    mockUsePathname.mockReturnValue("/platform/organizations/1")
    renderPanelHeader()
    expect(screen.getByText("Acme")).toBeInTheDocument()
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })
})

describe("PanelHeader — logo link", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWorkspaces.mockReturnValue({ data: [], isSuccess: true })
    mockUseOrganizations.mockReturnValue({ data: [], isSuccess: true })
    mockUsePathname.mockReturnValue("/")
  })

  it("points at the home page, not /workspaces", () => {
    renderPanelHeader()
    expect(screen.getByRole("link", { name: "ArchiSpark" })).toHaveAttribute(
      "href",
      "/"
    )
  })
})
