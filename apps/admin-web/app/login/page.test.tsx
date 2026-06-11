import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { I18nProvider } from "@/lib/i18n";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const usernameSignIn = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  signIn: { username: (...args: unknown[]) => usernameSignIn(...args), oauth2: vi.fn() },
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
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    usernameSignIn.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the login form", async () => {
    mockFetchSequence([[], { login_message: null, login_message_enabled: false }]);
    renderWithI18n(<LoginPage />);
    expect(screen.getByLabelText(/Nom d.utilisateur|Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe|Password/i)).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
  });

  it("submits the form and redirects on success", async () => {
    mockFetchSequence([[], { login_message: null, login_message_enabled: false }]);
    usernameSignIn.mockResolvedValue({ error: null });

    renderWithI18n(<LoginPage />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Nom d.utilisateur|Username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/Mot de passe|Password/i), { target: { value: "password" } });

    const form = screen.getByLabelText(/Nom d.utilisateur|Username/i).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => expect(usernameSignIn).toHaveBeenCalledWith({ username: "admin", password: "password" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(refresh).toHaveBeenCalled();
  });

  it("displays an error message when sign in fails", async () => {
    mockFetchSequence([[], { login_message: null, login_message_enabled: false }]);
    usernameSignIn.mockResolvedValue({ error: { message: "Identifiants invalides" } });

    renderWithI18n(<LoginPage />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Nom d.utilisateur|Username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/Mot de passe|Password/i), { target: { value: "wrong" } });

    const form = screen.getByLabelText(/Nom d.utilisateur|Username/i).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText("Identifiants invalides")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("renders SSO provider buttons when providers are returned", async () => {
    mockFetchSequence([
      [{ id: "google", name: "Google" }],
      { login_message: null, login_message_enabled: false },
    ]);

    renderWithI18n(<LoginPage />);

    await waitFor(() => expect(screen.getByText(/Google/)).toBeInTheDocument());
  });

  it("displays the login message when enabled", async () => {
    mockFetchSequence([
      [],
      { login_message: "Demo: demo/demo123", login_message_enabled: true },
    ]);

    renderWithI18n(<LoginPage />);

    await waitFor(() => expect(screen.getByText("Demo: demo/demo123")).toBeInTheDocument());
  });
});
