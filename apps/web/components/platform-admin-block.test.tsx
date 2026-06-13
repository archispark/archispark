import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlatformAdminBlock } from "./platform-admin-block";
import { I18nProvider } from "@/lib/i18n";

const { mockPush, mockRefresh, mockSignOut } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: mockSignOut,
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("PlatformAdminBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("renders the title, description and logout button using real i18n translations", () => {
    // Arrange & Act
    renderWithI18n(<PlatformAdminBlock />);

    // Assert
    expect(
      screen.getByRole("heading", { level: 1, name: "Accès non disponible" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Les comptes administrateur de la plateforme gèrent les organisations depuis l'interface d'administration et n'ont pas accès aux espaces de travail des organisations.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Déconnexion/i })).toBeInTheDocument();
  });

  it("signs out and redirects to /login when the logout button is clicked", async () => {
    // Arrange
    renderWithI18n(<PlatformAdminBlock />);
    const logoutButton = screen.getByRole("button", { name: /Déconnexion/i });

    // Act
    fireEvent.click(logoutButton);

    // Assert
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
