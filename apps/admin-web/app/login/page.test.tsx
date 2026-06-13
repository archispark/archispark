import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { I18nProvider } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

function mockFetchSequence(responses: unknown[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: true, json: async () => r });
  }
  vi.stubGlobal("fetch", fn);
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a link to the Keycloak login flow", async () => {
    mockFetchSequence([{ login_message: null, login_message_enabled: false }]);
    renderWithI18n(<LoginPage />);
    const link = screen.getByRole("link", { name: "Se connecter" });
    expect(link).toHaveAttribute("href", "/api/auth/login");
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
  });

  it("displays the login message when enabled", async () => {
    mockFetchSequence([{ login_message: "Demo: demo/demo123", login_message_enabled: true }]);

    renderWithI18n(<LoginPage />);

    await waitFor(() => expect(screen.getByText("Demo: demo/demo123")).toBeInTheDocument());
  });
});
