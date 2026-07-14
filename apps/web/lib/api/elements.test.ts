import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  fetchElements,
  fetchElement,
  fetchElementRelationships,
  fetchElementViews,
  fetchElementsInViews,
  fetchElementTypes,
  createElement,
  updateElement,
  deleteElement,
} from "./elements"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("fetchElementTypes", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns string array", async () => {
    mockFetchOk(["ApplicationComponent", "BusinessActor"])
    const types = await fetchElementTypes()
    expect(types).toContain("ApplicationComponent")
  })
})

describe("fetchElements", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { identifier: "e1", name: "App", type: "ApplicationComponent" },
        ],
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches without filters", async () => {
    const result = await fetchElements()
    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe("ApplicationComponent")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements"),
      expect.any(Object)
    )
  })

  it("adds type query param when provided", async () => {
    await fetchElements("BusinessActor")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("type=BusinessActor"),
      expect.any(Object)
    )
  })

  it("adds name query param when provided", async () => {
    await fetchElements(null, "Search")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("name=Search"),
      expect.any(Object)
    )
  })

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    )
    await expect(fetchElements()).rejects.toThrow("API error: 500")
  })
})

describe("element detail helpers", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchElement returns element detail", async () => {
    mockFetchOk({
      identifier: "e1",
      name: "App",
      type: "ApplicationComponent",
      documentation: null,
      properties: [],
    })
    const el = await fetchElement("e1")
    expect(el.identifier).toBe("e1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1"),
      expect.any(Object)
    )
  })

  it("fetchElementRelationships returns relationships", async () => {
    mockFetchOk([
      { identifier: "r1", type: "Association", source: "e1", target: "e2" },
    ])
    const rels = await fetchElementRelationships("e1")
    expect(rels[0]!.identifier).toBe("r1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1/relationships"),
      expect.any(Object)
    )
  })

  it("fetchElementViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1" }])
    const views = await fetchElementViews("e1")
    expect(views[0]!.identifier).toBe("v1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1/views"),
      expect.any(Object)
    )
  })

  it("fetchElementsInViews returns id array", async () => {
    mockFetchOk(["e1", "e2"])
    const ids = await fetchElementsInViews()
    expect(ids).toContain("e1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/in-views"),
      expect.any(Object)
    )
  })
})

describe("element mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createElement posts and returns element", async () => {
    mockFetchOk({
      identifier: "e1",
      name: "App",
      type: "ApplicationComponent",
      documentation: null,
      properties: [],
    })
    const el = await createElement({
      name: "App",
      type: "ApplicationComponent",
    })
    expect(el.identifier).toBe("e1")
  })

  it("updateElement puts and returns element", async () => {
    mockFetchOk({
      identifier: "e1",
      name: "Updated",
      type: "ApplicationComponent",
      documentation: null,
      properties: [],
    })
    const el = await updateElement("e1", { name: "Updated" })
    expect(el.name).toBe("Updated")
  })

  it("deleteElement sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteElement("e1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("updateElement throws on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Not found" }),
      })
    )
    await expect(updateElement("bad", { name: "x" })).rejects.toThrow(
      "Not found"
    )
  })

  it("deleteElement throws when non-ok with no detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("parse fail")
        },
      })
    )
    await expect(deleteElement("bad")).rejects.toThrow()
  })
})

