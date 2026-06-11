import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

const setTheme = vi.fn();
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ resolvedTheme: "light", setTheme }),
}));

describe("ThemeProvider hotkey", () => {
  it("ignores keydown events with no key (e.g. IME/autofill) without throwing", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    // KeyboardEvent without a `key` — event.key is undefined here.
    const event = new Event("keydown", { bubbles: true }) as KeyboardEvent;
    expect(() => window.dispatchEvent(event)).not.toThrow();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("toggles theme on the 'd' hotkey", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
