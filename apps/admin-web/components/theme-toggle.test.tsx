import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "./theme-toggle";
import { I18nProvider } from "@/lib/i18n";

const setTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme }),
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear();
    localStorage.clear();
  });

  it("renders a button", () => {
    renderWithI18n(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("cycles theme preference on click", () => {
    renderWithI18n(<ThemeToggle />);
    const button = screen.getByRole("button");
    // default pref is "dark" -> clicking moves to "auto"
    fireEvent.click(button);
    expect(localStorage.getItem("theme-pref")).toBe("auto");
  });

  it("reads saved theme preference from localStorage", () => {
    localStorage.setItem("theme-pref", "light");
    renderWithI18n(<ThemeToggle />);
    const button = screen.getByRole("button");
    // light -> dark
    fireEvent.click(button);
    expect(localStorage.getItem("theme-pref")).toBe("dark");
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
