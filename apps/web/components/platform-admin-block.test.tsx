import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlatformAdminBlock } from "./platform-admin-block";
import { I18nProvider } from "@/lib/i18n";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("PlatformAdminBlock", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
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

  it("navigates to /api/auth/logout when the logout button is clicked", () => {
    // Arrange
    renderWithI18n(<PlatformAdminBlock />);
    const logoutButton = screen.getByRole("button", { name: /Déconnexion/i });

    // Act
    fireEvent.click(logoutButton);

    // Assert
    expect(window.location.href).toBe("/api/auth/logout");
  });
});
