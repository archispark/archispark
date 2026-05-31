/**
 * Unit tests for redis.ts — initRedis / getRedis branches.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

const mockOn = vi.fn();
// Must be a regular function (not an arrow) so `new MockRedis()` works.
// When a constructor returns a plain object, `new` uses that object as the result.
const MockRedis = vi.fn(function (this: unknown) {
  return { on: mockOn };
});

vi.mock("ioredis", () => ({ Redis: MockRedis }));

// Import AFTER mock so the mock is in place for module init
const { initRedis, getRedis } = await import("./redis.js");

describe("redis", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getRedis returns null when initRedis has not been called with a URL", () => {
    // No REDIS_URL set in test env → _redis stays null
    expect(getRedis()).toBeNull();
  });

  it("initRedis is a no-op when REDIS_URL is not set", () => {
    delete process.env["REDIS_URL"];
    initRedis();
    expect(MockRedis).not.toHaveBeenCalled();
    expect(getRedis()).toBeNull();
  });

  it("initRedis creates a Redis instance and registers event listeners when REDIS_URL is set", () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    try {
      initRedis();
      expect(MockRedis).toHaveBeenCalledWith("redis://localhost:6379", {
        maxRetriesPerRequest: 3,
        lazyConnect: false,
      });
      // Two event listeners registered: "connect" and "error"
      expect(mockOn).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
      expect(getRedis()).not.toBeNull();
    } finally {
      delete process.env["REDIS_URL"];
    }
  });

  it("connect listener logs a message", () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    try {
      initRedis();
      const connectCb = mockOn.mock.calls.find(([event]) => event === "connect")?.[1] as (() => void) | undefined;
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      connectCb?.();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[redis]"));
      logSpy.mockRestore();
    } finally {
      delete process.env["REDIS_URL"];
    }
  });

  it("error listener logs an error message", () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    try {
      initRedis();
      const errorCb = mockOn.mock.calls.find(([event]) => event === "error")?.[1] as ((err: Error) => void) | undefined;
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      errorCb?.(new Error("connection refused"));
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[redis]"), "connection refused");
      errSpy.mockRestore();
    } finally {
      delete process.env["REDIS_URL"];
    }
  });
});
