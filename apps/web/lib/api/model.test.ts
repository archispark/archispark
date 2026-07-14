import { describe, it, expect, afterEach, vi } from "vitest"
import { fetchModel, saveModel, importModel } from "./model"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("fetchModel", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns model info", async () => {
    mockFetchOk({
      identifier: "m1",
      name: "Model",
      element_count: 0,
      relationship_count: 0,
      view_count: 0,
      documentation: null,
      version: null,
      workspace_id: null,
      workspace_name: null,
    })
    const m = await fetchModel()
    expect(m.identifier).toBe("m1")
  })
})

describe("saveModel", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts and returns saved status", async () => {
    mockFetchOk({ saved: true, path: "/data/model.xml" })
    const res = await saveModel()
    expect(res.saved).toBe(true)
  })
})

describe("importModel", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts XML file and returns model info", async () => {
    mockFetchOk({
      identifier: "m1",
      name: "Imported",
      element_count: 5,
      relationship_count: 2,
      view_count: 1,
      documentation: null,
      version: null,
      workspace_id: null,
      workspace_name: null,
    })
    const file = new File(["<xml/>"], "model.xml", { type: "text/xml" })
    const m = await importModel(file)
    expect(m.identifier).toBe("m1")
  })

  it("throws on import error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Invalid XML" }),
      })
    )
    const file = new File(["<bad>"], "model.xml", { type: "text/xml" })
    await expect(importModel(file)).rejects.toThrow("Invalid XML")
  })
})

describe("importModel error handling branches", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("throws with fallback message when POST fails and json parse also fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => {
          throw new Error("parse fail")
        },
      })
    )
    const file = new File(["data"], "model.xml", { type: "text/xml" })
    await expect(importModel(file)).rejects.toThrow("HTTP 413")
  })

  it("throws fallback when POST fails and json has no detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      })
    )
    const file = new File(["data"], "model.xml", { type: "text/xml" })
    await expect(importModel(file)).rejects.toThrow("API error: 400")
  })
})
