import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RailLink } from "./rail-link";

function Icon({ className }: { className?: string }) {
  return <svg data-testid="icon" className={className} />;
}

describe("RailLink", () => {
  it("renders a link with the correct href and label", () => {
    render(
      <RailLink href="/users" icon={Icon} label="Users" active={false} onClick={() => {}} />,
    );
    const link = screen.getByRole("link", { name: "Users" });
    expect(link).toHaveAttribute("href", "/users");
    expect(link).toHaveAttribute("title", "Users");
  });

  it("applies active styling when active is true", () => {
    render(
      <RailLink href="/users" icon={Icon} label="Users" active={true} onClick={() => {}} />,
    );
    const link = screen.getByRole("link", { name: "Users" });
    expect(link.className).toContain("bg-card");
  });

  it("does not apply active styling when active is false", () => {
    render(
      <RailLink href="/users" icon={Icon} label="Users" active={false} onClick={() => {}} />,
    );
    const link = screen.getByRole("link", { name: "Users" });
    expect(link.className).toContain("text-muted-foreground");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <RailLink href="/users" icon={Icon} label="Users" active={false} onClick={onClick} />,
    );
    screen.getByRole("link", { name: "Users" }).click();
    expect(onClick).toHaveBeenCalled();
  });

  it("renders a badge when provided", () => {
    const { container } = render(
      <RailLink href="/users" icon={Icon} label="Users" active={false} onClick={() => {}} badge="amber" />,
    );
    expect(container.querySelector(".bg-amber-500")).toBeTruthy();
  });

  it("renders a destructive badge when provided", () => {
    const { container } = render(
      <RailLink href="/users" icon={Icon} label="Users" active={false} onClick={() => {}} badge="destructive" />,
    );
    expect(container.querySelector(".bg-destructive")).toBeTruthy();
  });
});
