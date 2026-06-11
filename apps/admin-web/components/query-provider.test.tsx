import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryProvider } from "./query-provider";

describe("QueryProvider", () => {
  it("renders children wrapped in a QueryClientProvider", () => {
    const { getByText } = render(
      <QueryProvider>
        <div>child content</div>
      </QueryProvider>,
    );
    expect(getByText("child content")).toBeTruthy();
  });
});
