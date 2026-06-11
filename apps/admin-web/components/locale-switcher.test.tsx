import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleSwitcher } from "./locale-switcher";
import { I18nProvider } from "@/lib/i18n";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("LocaleSwitcher", () => {
  it("renders the current locale", () => {
    renderWithI18n(<LocaleSwitcher />);
    expect(screen.getByText("fr")).toBeInTheDocument();
  });

  it("renders all locale options", () => {
    renderWithI18n(<LocaleSwitcher />);
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByText("Italiano")).toBeInTheDocument();
  });

  it("changes locale when an option is clicked", () => {
    renderWithI18n(<LocaleSwitcher />);
    fireEvent.click(screen.getByText("English"));
    expect(localStorage.getItem("locale")).toBe("en");
  });
});
