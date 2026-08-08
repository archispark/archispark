import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

const { mockThemeState } = vi.hoisted(() => ({
  mockThemeState: { resolvedTheme: "light" as string },
}));

const setTheme = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ resolvedTheme: mockThemeState.resolvedTheme, setTheme: setTheme }),
}));

describe("ThemeProvider hotkey", () => {
  beforeEach(() => {
    setTheme.mockClear();
    mockThemeState.resolvedTheme = "light";
  });

  it("ignores keydown events with no key (e.g. IME/autofill) without throwing", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const event = new Event("keydown", { bubbles: true }) as KeyboardEvent;
    expect(() => window.dispatchEvent(event)).not.toThrow();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("toggles theme light→dark on the 'd' hotkey", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles theme dark→light on the 'd' hotkey when resolvedTheme is dark", () => {
    mockThemeState.resolvedTheme = "dark";
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("ignores keydown when defaultPrevented", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const event = new KeyboardEvent("keydown", { key: "d", bubbles: true, cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("ignores keydown when repeat is true", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const event = new KeyboardEvent("keydown", { key: "d", bubbles: true, repeat: true });
    window.dispatchEvent(event);
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("ignores keydown when metaKey is held", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true, metaKey: true }));
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("ignores keydown when ctrlKey is held", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true, ctrlKey: true }));
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("ignores keydown when altKey is held", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true, altKey: true }));
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("ignores non-d key", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true }));
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("ignores 'd' key when target is an INPUT element (isTypingTarget returns true)", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const input = document.createElement("input");
    document.body.appendChild(input);
    // Dispatch from the element so jsdom sets event.target naturally via bubbling
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("ignores 'd' key when target is a TEXTAREA element", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("ignores 'd' key when target is a SELECT element", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const select = document.createElement("select");
    document.body.appendChild(select);
    select.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).not.toHaveBeenCalled();
    document.body.removeChild(select);
  });

  it("does NOT ignore 'd' key when target is a non-typing HTMLElement (e.g. div)", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).toHaveBeenCalledWith("dark");
    document.body.removeChild(div);
  });

  it("does NOT ignore 'd' key when target is null (isTypingTarget returns false)", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    // Dispatch directly on window — target will be window (not HTMLElement), returns false
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
