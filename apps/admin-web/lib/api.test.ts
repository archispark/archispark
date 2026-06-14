import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchUsers, createUser, updateUserApi, deleteUserApi,
  fetchPostgresStatus,
  fetchSiteMessages, updateSiteMessages,
} from "./api";

// ---------------------------------------------------------------------------
// GET / mutation helpers
// ---------------------------------------------------------------------------

function mockFetchOk(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
}

function mockFetchError(status = 500) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ detail: `HTTP ${status}` }),
  }));
}

afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

describe("Users", () => {
  it("fetchUsers returns user list", async () => {
    mockFetchOk([{ id: "u1", username: "admin", role: "platform_admin", created_at: "2024-01-01" }]);
    const users = await fetchUsers();
    expect(users[0]!.username).toBe("admin");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users"),
      expect.any(Object),
    );
  });

  it("fetchUsers throws on non-ok response", async () => {
    mockFetchError(500);
    await expect(fetchUsers()).rejects.toThrow("API error: 500");
  });

  it("createUser posts and returns user", async () => {
    mockFetchOk({ id: "u2", username: "newuser", role: "user", created_at: "2024-01-01" });
    const u = await createUser({ username: "newuser", password: "pass123" });
    expect(u.username).toBe("newuser");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("createUser throws with detail message on error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Username taken" }),
    }));
    await expect(createUser({ username: "dup", password: "pass123" })).rejects.toThrow("Username taken");
  });

  it("updateUserApi puts and returns user", async () => {
    mockFetchOk({ id: "u2", username: "bob", role: "platform_admin", created_at: "2024-01-01" });
    const u = await updateUserApi("u2", { role: "platform_admin" });
    expect(u.role).toBe("platform_admin");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users/u2"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("updateUserApi throws on error without detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("parse fail"); },
    }));
    await expect(updateUserApi("bad", { role: "user" })).rejects.toThrow("HTTP 500");
  });

  it("deleteUserApi sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteUserApi("u2");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users/u2"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("deleteUserApi throws on error", async () => {
    mockFetchError(404);
    await expect(deleteUserApi("missing")).rejects.toThrow("HTTP 404");
  });

  it("createUser falls back to the parsed HTTP status when the error body cannot be parsed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("invalid json"); },
    }));
    await expect(createUser({ username: "dup", password: "pass123" })).rejects.toThrow("HTTP 500");
  });

  it("createUser falls back to a generic message when the error body has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    }));
    await expect(createUser({ username: "dup", password: "pass123" })).rejects.toThrow("API error: 400");
  });

  it("updateUserApi falls back to a generic message when the error body has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({}),
    }));
    await expect(updateUserApi("u2", { role: "user" })).rejects.toThrow("API error: 422");
  });

  it("deleteUserApi falls back to the parsed HTTP status when the error body cannot be parsed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error("invalid json"); },
    }));
    await expect(deleteUserApi("u2")).rejects.toThrow("HTTP 503");
  });

  it("deleteUserApi falls back to a generic message when the error body has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({}),
    }));
    await expect(deleteUserApi("u2")).rejects.toThrow("API error: 409");
  });
});

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

describe("PostgreSQL", () => {
  it("fetchPostgresStatus returns status", async () => {
    mockFetchOk({ connected: true, host: "localhost", port: 5432, database: "archispark", version: "16.1" });
    const status = await fetchPostgresStatus();
    expect(status.connected).toBe(true);
    expect(status.database).toBe("archispark");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/postgres"),
      expect.any(Object),
    );
  });

  it("fetchPostgresStatus throws on non-ok response", async () => {
    mockFetchError(500);
    await expect(fetchPostgresStatus()).rejects.toThrow("API error: 500");
  });
});

// ---------------------------------------------------------------------------
// Site messages
// ---------------------------------------------------------------------------

describe("Site messages", () => {
  it("fetchSiteMessages returns messages", async () => {
    mockFetchOk({
      login_message: "Welcome", login_message_enabled: true,
      banner_message: null, banner_message_enabled: false,
    });
    const messages = await fetchSiteMessages();
    expect(messages.login_message).toBe("Welcome");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/messages"),
      expect.any(Object),
    );
  });

  it("fetchSiteMessages throws on non-ok response", async () => {
    mockFetchError(500);
    await expect(fetchSiteMessages()).rejects.toThrow("API error: 500");
  });

  it("updateSiteMessages puts and returns ok", async () => {
    mockFetchOk({ ok: true });
    const res = await updateSiteMessages({
      login_message: "Hi", login_message_enabled: true,
      banner_message: null, banner_message_enabled: false,
    });
    expect(res.ok).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/messages"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("updateSiteMessages throws on error", async () => {
    mockFetchError(500);
    await expect(updateSiteMessages({
      login_message: null, login_message_enabled: false,
      banner_message: null, banner_message_enabled: false,
    })).rejects.toThrow("HTTP 500");
  });
});
