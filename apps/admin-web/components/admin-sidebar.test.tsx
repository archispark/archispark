import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminSidebar } from "./admin-sidebar";
import { I18nProvider } from "@/lib/i18n";

const mockPathname = { current: "/organizations" };
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const noop = () => {};

describe("AdminSidebar", () => {
  it("renders all 4 section labels", () => {
    mockPathname.current = "/organizations";
    renderWithI18n(<AdminSidebar open={false} onClose={noop} collapsed={false} onToggleCollapse={noop} />);

    expect(screen.getAllByText(/Organisations|Organizations/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Utilisateurs|Users/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PostgreSQL|Postgres/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Messages/i).length).toBeGreaterThan(0);
  });

  it("applies active styling to the link matching the current pathname", () => {
    mockPathname.current = "/users";
    renderWithI18n(<AdminSidebar open={false} onClose={noop} collapsed={false} onToggleCollapse={noop} />);

    const usersLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/users");
    expect(usersLink?.className).toContain("bg-card");

    const orgsLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/organizations");
    expect(orgsLink?.className).not.toContain("bg-card");
  });

  it("applies active styling to nested paths", () => {
    mockPathname.current = "/users/123";
    renderWithI18n(<AdminSidebar open={false} onClose={noop} collapsed={false} onToggleCollapse={noop} />);

    const usersLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/users");
    expect(usersLink?.className).toContain("bg-card");
  });

  it("renders the mobile overlay only when open", () => {
    mockPathname.current = "/organizations";
    const { container, rerender } = render(
      <I18nProvider>
        <AdminSidebar open={false} onClose={noop} collapsed={false} onToggleCollapse={noop} />
      </I18nProvider>,
    );
    expect(container.querySelector(".fixed.inset-0")).toBeNull();

    rerender(
      <I18nProvider>
        <AdminSidebar open={true} onClose={noop} collapsed={false} onToggleCollapse={noop} />
      </I18nProvider>,
    );
    expect(container.querySelector(".fixed.inset-0")).toBeTruthy();
  });

  it("calls onToggleCollapse when the collapse button is clicked", () => {
    mockPathname.current = "/organizations";
    const onToggleCollapse = vi.fn();
    renderWithI18n(<AdminSidebar open={false} onClose={noop} collapsed={false} onToggleCollapse={onToggleCollapse} />);
    const button = screen.getByRole("button");
    button.click();
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});
