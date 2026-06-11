import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import RootPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("RootPage", () => {
  it("redirects to /organizations", () => {
    render(<RootPage />);
    expect(replace).toHaveBeenCalledWith("/organizations");
  });

  it("renders nothing", () => {
    const { container } = render(<RootPage />);
    expect(container.firstChild).toBeNull();
  });
});
