import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrentUser, useIsAdmin } from "./use-current-user";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return wrapper;
}

describe("useCurrentUser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null while loading and when /api/auth/me is unauthenticated (after a failed session refresh)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });
    expect(result.current).toBeNull();
    // A 401 triggers a POST /api/auth/refresh attempt before giving up —
    // shared session-refresh retry, same as every other API call.
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/refresh", { method: "POST", credentials: "include" }));
    expect(result.current).toBeNull();
  });

  it("retries /api/auth/me once after a successful session refresh", async () => {
    const user = { id: "u1", username: "admin", name: "Admin Archispark", email: "admin@archispark.internal", role: "platform_admin" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        // First call: expired access token. Second call (after refresh): succeeds.
        if (fetchMock.mock.calls.filter((c) => String(c[0]) === "/api/auth/me").length === 1) {
          return new Response(null, { status: 401 });
        }
        return new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } });
      }
      // /api/auth/refresh
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current?.username).toBe("admin"));
  });

  it("returns the user when /api/auth/me succeeds", async () => {
    const user = { id: "u1", username: "admin", name: "Admin Archispark", email: "admin@archispark.internal", role: "platform_admin" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } })));
    const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current?.username).toBe("admin"));
    expect(result.current?.role).toBe("platform_admin");
  });
});

describe("useIsAdmin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when there is no user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const { result } = renderHook(() => useIsAdmin(), { wrapper: createWrapper() });
    expect(result.current).toBe(false);
  });

  it("returns true when the user role is platform_admin", async () => {
    const user = { id: "u1", username: "admin", name: "Admin", email: null, role: "platform_admin" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } })));
    const { result } = renderHook(() => useIsAdmin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false when the user role is user", async () => {
    const user = { id: "u2", username: "bob", name: "Bob", email: null, role: "user" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } })));
    const { result } = renderHook(() => useIsAdmin(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toBe(false));
  });
});
