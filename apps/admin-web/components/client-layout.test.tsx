import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const mockSession: { current: { data: { user: { id: string; role?: string } } | null; isPending: boolean } } = {
  current: { data: null, isPending: false },
};
vi.mock("@/lib/auth-client", () => ({
  useSession: () => mockSession.current,
  signOut: vi.fn(),
}));

const mockCurrentUser: { current: { id: string; username: string; name: string; email: string | null; role: string } | null } = {
  current: null,
};
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => mockCurrentUser.current,
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
    mockSession.current = { data: { user: { id: "u1" } }, isPending: false };
    mockCurrentUser.current = { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" };

    renderWithI18n(
      <ClientLayout>
        <div>page content</div>
      </ClientLayout>,
    );

    await waitFor(() => expect(screen.getByText("page content")).toBeInTheDocument());
  });

  it("redirects to /login when there is no session", async () => {
    mockPathname.current = "/organizations";
    mockSession.current = { data: null, isPending: false };
    mockCurrentUser.current = null;

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
    mockSession.current = { data: { user: { id: "u1" } }, isPending: false };
    mockCurrentUser.current = { id: "u1", username: "bob", name: "Bob", email: null, role: "user" };

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
    mockSession.current = { data: null, isPending: false };
    mockCurrentUser.current = null;

    renderWithI18n(
      <ClientLayout>
        <div>login page content</div>
      </ClientLayout>,
    );

    expect(screen.getByText("login page content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
