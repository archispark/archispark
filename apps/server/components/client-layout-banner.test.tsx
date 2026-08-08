import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ClientLayout } from "./client-layout"

const { mockUsePathname, mockUseIsAdmin } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockUseIsAdmin: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}))

vi.mock("@/hooks/use-current-user", () => ({
  useIsAdmin: mockUseIsAdmin,
}))

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/platform-admin-block", () => ({
  PlatformAdminBlock: () => (
    <div data-testid="platform-admin-block">blocked</div>
  ),
}))

vi.mock("@/components/nav", () => ({
  Nav: ({ onToggleSidebar }: { onToggleSidebar: () => void }) => (
    <div data-testid="nav">
      nav
      <button
        type="button"
        data-testid="toggle-mobile-sidebar"
        onClick={onToggleSidebar}
      >
        toggle sidebar
      </button>
    </div>
  ),
}))

vi.mock("@/components/sidebar", () => ({
  Sidebar: ({
    open,
    onClose,
    collapsed,
    onToggleCollapse,
  }: {
    open: boolean
    onClose: () => void
    collapsed: boolean
    onToggleCollapse: () => void
  }) => (
    <div data-testid="sidebar" data-open={open} data-collapsed={collapsed}>
      sidebar
      <button
        type="button"
        data-testid="toggle-collapse"
        onClick={onToggleCollapse}
      >
        toggle
      </button>
      <button type="button" data-testid="close-sidebar" onClick={onClose}>
        close
      </button>
    </div>
  ),
}))

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster">toaster</div>,
}))

// jsdom doesn't implement fetch by default — SiteBanner calls it on mount.
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          banner_message: null,
          banner_message_enabled: false,
        }),
    })
  )
})

describe("ClientLayout — SiteBanner", () => {
  it("shows a banner fetched from the settings API and allows dismissing it", async () => {
    // Arrange
    mockUsePathname.mockReturnValue("/dashboard")
    mockUseIsAdmin.mockReturnValue(false)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            banner_message: "Maintenance tonight",
            banner_message_enabled: true,
          }),
      })
    )

    // Act
    render(
      <ClientLayout>
        <div data-testid="page-content">content</div>
      </ClientLayout>
    )

    // Assert — banner appears
    expect(await screen.findByText("Maintenance tonight")).toBeInTheDocument()

    // Act — dismiss it
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))

    // Assert — banner is hidden and dismissal persisted
    expect(screen.queryByText("Maintenance tonight")).not.toBeInTheDocument()
    expect(sessionStorage.getItem("banner-dismissed:Maintenance tonight")).toBe(
      "1"
    )
  })

  it("does not show a banner when banner_message_enabled is false", async () => {
    // Arrange
    mockUsePathname.mockReturnValue("/dashboard")
    mockUseIsAdmin.mockReturnValue(false)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            banner_message: "Hidden",
            banner_message_enabled: false,
          }),
      })
    )

    // Act
    render(
      <ClientLayout>
        <div data-testid="page-content">content</div>
      </ClientLayout>
    )

    // Assert
    await waitFor(() =>
      expect(screen.queryByText("Hidden")).not.toBeInTheDocument()
    )
  })

  it("does not show a banner that was previously dismissed", async () => {
    // Arrange
    mockUsePathname.mockReturnValue("/dashboard")
    mockUseIsAdmin.mockReturnValue(false)
    sessionStorage.setItem("banner-dismissed:Already seen", "1")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            banner_message: "Already seen",
            banner_message_enabled: true,
          }),
      })
    )

    // Act
    render(
      <ClientLayout>
        <div data-testid="page-content">content</div>
      </ClientLayout>
    )

    // Assert
    await waitFor(() =>
      expect(screen.queryByText("Already seen")).not.toBeInTheDocument()
    )
  })

  it("does not blow up when the settings fetch rejects", async () => {
    // Arrange
    mockUsePathname.mockReturnValue("/dashboard")
    mockUseIsAdmin.mockReturnValue(false)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    )

    // Act
    render(
      <ClientLayout>
        <div data-testid="page-content">content</div>
      </ClientLayout>
    )

    // Assert — nothing rendered for the banner, page content still shows
    await waitFor(() =>
      expect(screen.getByTestId("page-content")).toBeInTheDocument()
    )
    expect(
      screen.queryByRole("button", { name: "Fermer" })
    ).not.toBeInTheDocument()
  })

  it("does not render the SiteBanner on /login", () => {
    // Arrange
    mockUsePathname.mockReturnValue("/login")
    mockUseIsAdmin.mockReturnValue(false)

    // Act
    render(
      <ClientLayout>
        <div data-testid="page-content">content</div>
      </ClientLayout>
    )

    // Assert
    expect(
      screen.queryByRole("button", { name: "Fermer" })
    ).not.toBeInTheDocument()
  })
})
