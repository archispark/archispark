import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClientLayout } from "./client-layout";

const { mockUsePathname, mockUseIsAdmin, mockUseHasNoOrganization } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockUseIsAdmin: vi.fn(),
  mockUseHasNoOrganization: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("@/hooks/use-current-user", () => ({
  useIsAdmin: mockUseIsAdmin,
  useHasNoOrganization: mockUseHasNoOrganization,
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/platform-admin-block", () => ({
  PlatformAdminBlock: () => <div data-testid="platform-admin-block">blocked</div>,
}));

vi.mock("@/components/no-organization-block", () => ({
  NoOrganizationBlock: () => <div data-testid="no-organization-block">blocked</div>,
}));

vi.mock("@/components/nav", () => ({
  Nav: ({ onToggleSidebar }: { onToggleSidebar: () => void }) => (
    <div data-testid="nav">
      nav
      <button type="button" data-testid="toggle-mobile-sidebar" onClick={onToggleSidebar}>
        toggle sidebar
      </button>
    </div>
  ),
}));

vi.mock("@/components/sidebar", () => ({
  Sidebar: ({
    open,
    onClose,
    collapsed,
    onToggleCollapse,
  }: {
    open: boolean;
    onClose: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
  }) => (
    <div data-testid="sidebar" data-open={open} data-collapsed={collapsed}>
      sidebar
      <button type="button" data-testid="toggle-collapse" onClick={onToggleCollapse}>
        toggle
      </button>
      <button type="button" data-testid="close-sidebar" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock("@/components/organization-sidebar", () => ({
  OrganizationSidebar: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) => (
    <div data-testid="organization-sidebar" data-open={open}>
      organization-sidebar
      <button type="button" data-testid="close-organization-sidebar" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster">toaster</div>,
}));

// jsdom doesn't implement fetch by default — SiteBanner calls it on mount.
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockUseHasNoOrganization.mockReturnValue(false);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ banner_message: null, banner_message_enabled: false }),
    }),
  );
});

describe("ClientLayout", () => {
  describe("platform_admin gating", () => {
    it("renders only the PlatformAdminBlock when the session is a platform admin and not on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(true);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.getByTestId("platform-admin-block")).toBeInTheDocument();
      expect(screen.queryByTestId("nav")).not.toBeInTheDocument();
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("organization-sidebar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
    });

    it("renders the normal layout (not PlatformAdminBlock) when the session is a platform admin but on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/login");
      mockUseIsAdmin.mockReturnValue(true);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.queryByTestId("platform-admin-block")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nav")).not.toBeInTheDocument();
      expect(screen.getByTestId("page-content")).toBeInTheDocument();
    });
  });

  describe("no_organization gating", () => {
    it("renders only the NoOrganizationBlock when the session has no organization and not on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);
      mockUseHasNoOrganization.mockReturnValue(true);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.getByTestId("no-organization-block")).toBeInTheDocument();
      expect(screen.queryByTestId("nav")).not.toBeInTheDocument();
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("organization-sidebar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
    });

    it("renders the normal layout (not NoOrganizationBlock) when the session has no organization but is on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/login");
      mockUseIsAdmin.mockReturnValue(false);
      mockUseHasNoOrganization.mockReturnValue(true);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.queryByTestId("no-organization-block")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nav")).not.toBeInTheDocument();
      expect(screen.getByTestId("page-content")).toBeInTheDocument();
    });

    it("prefers PlatformAdminBlock over NoOrganizationBlock when both flags are set", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(true);
      mockUseHasNoOrganization.mockReturnValue(true);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.getByTestId("platform-admin-block")).toBeInTheDocument();
      expect(screen.queryByTestId("no-organization-block")).not.toBeInTheDocument();
    });
  });

  describe("normal layout", () => {
    it("renders Nav, Sidebar and children when not a platform admin and not on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.queryByTestId("platform-admin-block")).not.toBeInTheDocument();
      expect(screen.getByTestId("nav")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
      expect(screen.queryByTestId("organization-sidebar")).not.toBeInTheDocument();
      expect(screen.getByTestId("page-content")).toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
    });

    it("renders the OrganizationSidebar instead of Sidebar on /organization routes", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/organization/members");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.getByTestId("organization-sidebar")).toBeInTheDocument();
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    });

    it("hides the Nav and Sidebar on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/login");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.queryByTestId("nav")).not.toBeInTheDocument();
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
      expect(screen.getByTestId("page-content")).toBeInTheDocument();
    });

    it("hides the Sidebar on /workspaces while still showing Nav", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/workspaces");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.getByTestId("nav")).toBeInTheDocument();
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("organization-sidebar")).not.toBeInTheDocument();
    });

    it("toggles the mobile sidebar open state via Nav and closes it via Sidebar", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert — closed by default
      expect(screen.getByTestId("sidebar").dataset.open).toBe("false");

      // Act — open via Nav's toggle
      fireEvent.click(screen.getByTestId("toggle-mobile-sidebar"));

      // Assert — sidebar is now open
      expect(screen.getByTestId("sidebar").dataset.open).toBe("true");

      // Act — close via the Sidebar's onClose
      fireEvent.click(screen.getByTestId("close-sidebar"));

      // Assert — sidebar is closed again
      expect(screen.getByTestId("sidebar").dataset.open).toBe("false");
    });

    it("closes the mobile OrganizationSidebar via its onClose callback", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/organization/members");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );
      fireEvent.click(screen.getByTestId("toggle-mobile-sidebar"));

      // Assert — open after toggling
      expect(screen.getByTestId("organization-sidebar").dataset.open).toBe("true");

      // Act
      fireEvent.click(screen.getByTestId("close-organization-sidebar"));

      // Assert
      expect(screen.getByTestId("organization-sidebar").dataset.open).toBe("false");
    });

    it("restores the collapsed sidebar state from localStorage on mount and persists toggles", async () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);
      localStorage.setItem("sidebar-collapsed", "1");

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert — restored as collapsed on mount
      const sidebar = await screen.findByTestId("sidebar");
      expect(sidebar.dataset.collapsed).toBe("true");

      // Act — toggle back to expanded
      fireEvent.click(screen.getByTestId("toggle-collapse"));

      // Assert — state flips and is persisted
      expect(screen.getByTestId("sidebar").dataset.collapsed).toBe("false");
      expect(localStorage.getItem("sidebar-collapsed")).toBe("0");

      // Act — toggle again to collapse
      fireEvent.click(screen.getByTestId("toggle-collapse"));

      // Assert — state flips back and is persisted
      expect(screen.getByTestId("sidebar").dataset.collapsed).toBe("true");
      expect(localStorage.getItem("sidebar-collapsed")).toBe("1");
    });
  });

  describe("SiteBanner", () => {
    it("shows a banner fetched from the settings API and allows dismissing it", async () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: () =>
            Promise.resolve({ banner_message: "Maintenance tonight", banner_message_enabled: true }),
        }),
      );

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert — banner appears
      expect(await screen.findByText("Maintenance tonight")).toBeInTheDocument();

      // Act — dismiss it
      fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

      // Assert — banner is hidden and dismissal persisted
      expect(screen.queryByText("Maintenance tonight")).not.toBeInTheDocument();
      expect(sessionStorage.getItem("banner-dismissed:Maintenance tonight")).toBe("1");
    });

    it("does not show a banner when banner_message_enabled is false", async () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ banner_message: "Hidden", banner_message_enabled: false }),
        }),
      );

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      await waitFor(() => expect(screen.queryByText("Hidden")).not.toBeInTheDocument());
    });

    it("does not show a banner that was previously dismissed", async () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);
      sessionStorage.setItem("banner-dismissed:Already seen", "1");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ banner_message: "Already seen", banner_message_enabled: true }),
        }),
      );

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      await waitFor(() => expect(screen.queryByText("Already seen")).not.toBeInTheDocument());
    });

    it("does not blow up when the settings fetch rejects", async () => {
      // Arrange
      mockUsePathname.mockReturnValue("/dashboard");
      mockUseIsAdmin.mockReturnValue(false);
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert — nothing rendered for the banner, page content still shows
      await waitFor(() => expect(screen.getByTestId("page-content")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Fermer" })).not.toBeInTheDocument();
    });

    it("does not render the SiteBanner on /login", () => {
      // Arrange
      mockUsePathname.mockReturnValue("/login");
      mockUseIsAdmin.mockReturnValue(false);

      // Act
      render(
        <ClientLayout>
          <div data-testid="page-content">content</div>
        </ClientLayout>,
      );

      // Assert
      expect(screen.queryByRole("button", { name: "Fermer" })).not.toBeInTheDocument();
    });
  });
});
