import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./nav";
import { I18nProvider } from "@/lib/i18n";

const mockPathname = { current: "/organizations" };
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
}));

vi.mock("@/components/locale-switcher", () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const noop = () => {};

describe("Nav", () => {
  it("renders the LocaleSwitcher, ThemeToggle and UserMenu", () => {
    mockPathname.current = "/organizations";
    renderWithI18n(<Nav onToggleSidebar={noop} />);
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("shows the breadcrumb section label for a known path", () => {
    mockPathname.current = "/users";
    renderWithI18n(<Nav onToggleSidebar={noop} />);
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument();
  });

  it("does not show a breadcrumb section label on the root path", () => {
    mockPathname.current = "/";
    renderWithI18n(<Nav onToggleSidebar={noop} />);
    expect(screen.queryByText("Utilisateurs")).not.toBeInTheDocument();
    expect(screen.queryByText("Organisations")).not.toBeInTheDocument();
  });

  it("calls onToggleSidebar when the menu button is clicked", () => {
    mockPathname.current = "/organizations";
    const onToggleSidebar = vi.fn();
    renderWithI18n(<Nav onToggleSidebar={onToggleSidebar} />);
    screen.getByRole("button", { name: "Toggle menu" }).click();
    expect(onToggleSidebar).toHaveBeenCalled();
  });

  it("renders the ArchiSpark Admin brand link", () => {
    mockPathname.current = "/organizations";
    renderWithI18n(<Nav onToggleSidebar={noop} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/organizations");
  });
});
