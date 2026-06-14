import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ClientLayout } from "./client-layout";
import { I18nProvider } from "@/lib/i18n";

const mockPathname = { current: "/organizations" };
const replace = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
  useRouter: () => ({ replace, push, refresh }),
}));

const mockCurrentUser: {
  current: { data: { id: string; username: string; name: string; email: string | null; role: string } | null; isPending: boolean };
} = {
  current: { data: null, isPending: false },
};
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUserQuery: () => mockCurrentUser.current,
  useCurrentUser: () => mockCurrentUser.current.data,
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("ClientLayout", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    refresh.mockClear();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        login_message: null, login_message_enabled: false,
        banner_message: null, banner_message_enabled: false,
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders children when the user is platform_admin", async () => {
    mockPathname.current = "/organizations";
    mockCurrentUser.current = {
      data: { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" },
      isPending: false,
    };

    renderWithI18n(
      <ClientLayout>
        <div>page content</div>
      </ClientLayout>,
    );

    await waitFor(() => expect(screen.getByText("page content")).toBeInTheDocument());
  });

  it("redirects to /login when there is no user", async () => {
    mockPathname.current = "/organizations";
    mockCurrentUser.current = { data: null, isPending: false };

    renderWithI18n(
      <ClientLayout>
        <div>page content</div>
      </ClientLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("redirects to /login when the user role is not platform_admin", async () => {
    mockPathname.current = "/organizations";
    mockCurrentUser.current = {
      data: { id: "u1", username: "bob", name: "Bob", email: null, role: "user" },
      isPending: false,
    };

    renderWithI18n(
      <ClientLayout>
        <div>page content</div>
      </ClientLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("renders children directly without the guard on the /login path", () => {
    mockPathname.current = "/login";
    mockCurrentUser.current = { data: null, isPending: false };

    renderWithI18n(
      <ClientLayout>
        <div>login page content</div>
      </ClientLayout>,
    );

    expect(screen.getByText("login page content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  describe("SiteBanner", () => {
    it("shows a banner fetched from the settings API and allows dismissing it", async () => {
      mockPathname.current = "/organizations";
      mockCurrentUser.current = {
        data: { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" },
        isPending: false,
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          login_message: null, login_message_enabled: false,
          banner_message: "Maintenance tonight", banner_message_enabled: true,
        }),
      }));

      renderWithI18n(
        <ClientLayout>
          <div>page content</div>
        </ClientLayout>,
      );

      expect(await screen.findByText("Maintenance tonight")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

      expect(screen.queryByText("Maintenance tonight")).not.toBeInTheDocument();
      expect(sessionStorage.getItem("banner-dismissed:Maintenance tonight")).toBe("1");
    });

    it("does not show a banner that was previously dismissed", async () => {
      mockPathname.current = "/organizations";
      mockCurrentUser.current = {
        data: { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" },
        isPending: false,
      };
      sessionStorage.setItem("banner-dismissed:Already seen", "1");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          login_message: null, login_message_enabled: false,
          banner_message: "Already seen", banner_message_enabled: true,
        }),
      }));

      renderWithI18n(
        <ClientLayout>
          <div>page content</div>
        </ClientLayout>,
      );

      await waitFor(() => expect(screen.getByText("page content")).toBeInTheDocument());
      expect(screen.queryByText("Already seen")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Fermer" })).not.toBeInTheDocument();
    });
  });

  describe("sidebar interactions", () => {
    it("toggles the mobile sidebar open and closes it via the overlay", async () => {
      mockPathname.current = "/organizations";
      mockCurrentUser.current = {
        data: { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" },
        isPending: false,
      };

      const { container } = renderWithI18n(
        <ClientLayout>
          <div>page content</div>
        </ClientLayout>,
      );

      await waitFor(() => expect(screen.getByText("page content")).toBeInTheDocument());

      // No overlay until the sidebar is opened
      expect(container.querySelector(".fixed.inset-0.bg-foreground\\/40")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));

      const overlay = container.querySelector(".fixed.inset-0.bg-foreground\\/40");
      expect(overlay).not.toBeNull();

      fireEvent.click(overlay!);

      expect(container.querySelector(".fixed.inset-0.bg-foreground\\/40")).toBeNull();
    });

    it("toggles and persists the collapsed sidebar state in localStorage", async () => {
      mockPathname.current = "/organizations";
      mockCurrentUser.current = {
        data: { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" },
        isPending: false,
      };

      renderWithI18n(
        <ClientLayout>
          <div>page content</div>
        </ClientLayout>,
      );

      await waitFor(() => expect(screen.getByText("page content")).toBeInTheDocument());

      const collapseButton = screen.getByRole("button", { name: "Réduire la barre latérale" });
      fireEvent.click(collapseButton);

      expect(localStorage.getItem("sidebar-collapsed")).toBe("1");
      expect(await screen.findByRole("button", { name: "Agrandir la barre latérale" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Agrandir la barre latérale" }));

      expect(localStorage.getItem("sidebar-collapsed")).toBe("0");
    });

    it("restores the collapsed sidebar state from localStorage on mount", async () => {
      localStorage.setItem("sidebar-collapsed", "1");
      mockPathname.current = "/organizations";
      mockCurrentUser.current = {
        data: { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" },
        isPending: false,
      };

      renderWithI18n(
        <ClientLayout>
          <div>page content</div>
        </ClientLayout>,
      );

      expect(await screen.findByRole("button", { name: "Agrandir la barre latérale" })).toBeInTheDocument();
    });
  });
});
