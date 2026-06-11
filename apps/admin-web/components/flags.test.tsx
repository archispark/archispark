import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Flag } from "./flags";

describe("Flag", () => {
  it("renders an svg for the fr code", () => {
    const { container } = render(<Flag code="fr" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders an svg for the gb code (Union Jack)", () => {
    const { container } = render(<Flag code="gb" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 60 30");
  });

  it("renders an svg for de, es, it codes", () => {
    for (const code of ["de", "es", "it"]) {
      const { container } = render(<Flag code={code} />);
      expect(container.querySelector("svg")).toBeTruthy();
    }
  });

  it("returns null for an unknown code", () => {
    const { container } = render(<Flag code="zz" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("applies a custom className", () => {
    const { container } = render(<Flag code="fr" className="custom-class" />);
    expect(container.querySelector("svg.custom-class")).toBeTruthy();
  });
});
