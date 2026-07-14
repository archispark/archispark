/**
 * Error-handling branches of client.ts's post/put/del wrappers — exercised
 * via elements.ts functions as the vehicle (any domain would do; elements
 * happens to have create/update/delete covering all three verbs).
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { createElement, updateElement, deleteElement } from "./elements"

describe("POST error handling — json parse failure", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createElement throws with fallback message when POST fails and json parse also fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error("parse fail")
        },
      })
    )
    await expect(
      createElement({ name: "App", type: "ApplicationComponent" })
    ).rejects.toThrow("HTTP 503")
  })

  it("createElement throws with err.detail when POST fails with parseable json but no detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      })
    )
    await expect(
      createElement({ name: "App", type: "ApplicationComponent" })
    ).rejects.toThrow("API error: 400")
  })
})

describe("PUT error handling branches", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("updateElement throws fallback when PUT fails and json has no detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({}),
      })
    )
    await expect(updateElement("e1", { name: "X" })).rejects.toThrow(
      "API error: 422"
    )
  })
})

describe("DELETE error handling branches", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("deleteElement throws with fallback message when DELETE fails and json parse also fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("parse fail")
        },
      })
    )
    await expect(deleteElement("e1")).rejects.toThrow("HTTP 500")
  })

  it("deleteElement throws fallback when DELETE fails and json has no detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
    )
    await expect(deleteElement("e1")).rejects.toThrow("API error: 404")
  })
})
