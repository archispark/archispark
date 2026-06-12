/**
 * Unit tests for redis.ts — initRedis / getRedis branches.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// Annule le mock global de test-setup.ts pour tester l'implémentation réelle.
vi.unmock("./redis.js");

import { initRedis, getRedis } from "./redis.js";

// vi.hoisted() runs before any import, so MockRedis is available when the
// vi.mock factory executes (which happens when redis.js imports ioredis).
const { mockOn, mockOnce, MockRedis } = vi.hoisted(() => {
  const mockOn = vi.fn();
  const mockOnce = vi.fn();
  // Regular function (not arrow) so `new MockRedis()` works — when a
  // constructor returns a plain object, `new` uses that returned object.
  const MockRedis = vi.fn(function (this: unknown) {
    return { on: mockOn, once: mockOnce };
  });
  return { mockOn, mockOnce, MockRedis };
});

vi.mock("ioredis", () => ({ Redis: MockRedis }));

describe("redis", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getRedis throws when initRedis has not been called", () => {
    expect(() => getRedis()).toThrow("[redis] Non initialisé");
  });

  it("initRedis throws when REDIS_URL is not set", () => {
    delete process.env["REDIS_URL"];
    expect(() => initRedis()).toThrow("[redis] REDIS_URL non défini");
    expect(MockRedis).not.toHaveBeenCalled();
  });

  it("initRedis creates a Redis instance and registers event listeners when REDIS_URL is set", () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    try {
      initRedis(); // returns Promise; mock never fires ready/error so it stays pending
      expect(MockRedis).toHaveBeenCalledWith("redis://localhost:6379", {
        maxRetriesPerRequest: 3,
        lazyConnect: false,
      });
      expect(mockOnce).toHaveBeenCalledWith("ready", expect.any(Function));
      expect(mockOnce).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
      expect(getRedis()).not.toBeNull();
    } finally {
      delete process.env["REDIS_URL"];
    }
  });

  it("ready listener resolves the promise and logs a message", async () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    try {
      const p = initRedis();
      const readyCb = mockOnce.mock.calls.find(([event]) => event === "ready")?.[1] as (() => void) | undefined;
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      readyCb?.();
      await expect(p).resolves.toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[redis]"));
      logSpy.mockRestore();
    } finally {
      delete process.env["REDIS_URL"];
    }
  });

  it("error listener rejects the promise and logs", async () => {
    process.env["REDIS_URL"] = "redis://localhost:6379";
    try {
      const p = initRedis();
      const errorCb = mockOnce.mock.calls.find(([event]) => event === "error")?.[1] as ((err: Error) => void) | undefined;
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      errorCb?.(new Error("connection refused"));
      await expect(p).rejects.toThrow("connection refused");
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[redis]"), "connection refused");
      errSpy.mockRestore();
    } finally {
      delete process.env["REDIS_URL"];
    }
  });
});
