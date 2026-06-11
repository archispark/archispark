import { describe, it, expect, beforeEach } from "vitest";
import { render, act, renderHook } from "@testing-library/react";
import { I18nProvider, useT } from "./i18n";

// ---------------------------------------------------------------------------
// Wrapper helper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

// ---------------------------------------------------------------------------
// t() — basic key lookup
// ---------------------------------------------------------------------------

describe("useT()", () => {
  it("returns the French translation for a key", () => {
    const { result } = renderHook(() => useT(), { wrapper: Wrapper });
    // "login.title" exists in fr.json
    expect(result.current.t("login.title")).toBeTruthy();
    expect(typeof result.current.t("login.title")).toBe("string");
  });

  it("returns the key string when outside a provider (default context)", () => {
    const { result } = renderHook(() => useT());
    const key = "login.title" as Parameters<typeof result.current.t>[0];
    // Default context t() returns String(key)
    expect(result.current.t(key)).toBe(key);
  });

  it("substitutes params in the translation string", () => {
    const { result } = renderHook(() => useT(), { wrapper: Wrapper });
    // "login.continue_with" contains "{name}" in the translation files
    const translated = result.current.t("login.continue_with", { name: "Google" });
    expect(translated).toContain("Google");
    expect(translated).not.toContain("{name}");
  });
});

// ---------------------------------------------------------------------------
// setLocale — locale switching
// ---------------------------------------------------------------------------

describe("setLocale()", () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { store = {}; },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });
    localStorageMock.clear();
  });

  it("persists locale to localStorage", () => {
    const { result } = renderHook(() => useT(), { wrapper: Wrapper });
    act(() => { result.current.setLocale("en"); });
    expect(localStorageMock.getItem("locale")).toBe("en");
  });

  it("restores locale from localStorage on mount", () => {
    localStorageMock.setItem("locale", "de");
    const { result } = renderHook(() => useT(), { wrapper: Wrapper });
    // After mount effect fires, locale should be "de"
    expect(result.current.locale).toBe("de");
  });

  it("ignores invalid locale values in localStorage", () => {
    localStorageMock.setItem("locale", "xx");
    const { result } = renderHook(() => useT(), { wrapper: Wrapper });
    // Invalid locale → stays on default "fr"
    expect(result.current.locale).toBe("fr");
  });
});

// ---------------------------------------------------------------------------
// I18nProvider rendering
// ---------------------------------------------------------------------------

describe("I18nProvider", () => {
  it("renders children", () => {
    const { getByText } = render(
      <I18nProvider>
        <div>hello</div>
      </I18nProvider>,
    );
    expect(getByText("hello")).toBeTruthy();
  });
});
