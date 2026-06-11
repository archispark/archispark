import "@testing-library/jest-dom";

// next-themes reads `window.matchMedia` to detect the system color scheme.
// jsdom doesn't implement it, so provide a minimal stub.
if (globalThis.window !== undefined && !globalThis.window.matchMedia) {
  globalThis.window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
