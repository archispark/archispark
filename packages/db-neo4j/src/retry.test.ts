import { describe, it, expect } from "vitest"
import { isRetriableNeo4jFailure, wait, MAX_IMPORT_ATTEMPTS } from "./retry.js"

describe("isRetriableNeo4jFailure", () => {
  it("treats an explicit retriable/retryable flag as retriable", () => {
    expect(isRetriableNeo4jFailure({ retriable: true })).toBe(true)
    expect(isRetriableNeo4jFailure({ retryable: true })).toBe(true)
    expect(isRetriableNeo4jFailure({ retriable: false })).toBe(false)
  })

  it("treats known transient connection error messages as retriable", () => {
    expect(isRetriableNeo4jFailure(new Error("ECONNRESET"))).toBe(true)
    expect(isRetriableNeo4jFailure(new Error("SessionExpired: boom"))).toBe(true)
    expect(isRetriableNeo4jFailure(new Error("Failed to connect to server"))).toBe(true)
  })

  it("treats anything else as non-retriable", () => {
    expect(isRetriableNeo4jFailure(new Error("constraint violation"))).toBe(false)
    expect(isRetriableNeo4jFailure("plain string error")).toBe(false)
    expect(isRetriableNeo4jFailure(null)).toBe(false)
  })
})

describe("wait", () => {
  it("resolves after the given delay", async () => {
    const start = Date.now()
    await wait(10)
    expect(Date.now() - start).toBeGreaterThanOrEqual(9)
  })
})

describe("MAX_IMPORT_ATTEMPTS", () => {
  it("is a positive integer", () => {
    expect(MAX_IMPORT_ATTEMPTS).toBeGreaterThan(0)
  })
})
