import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  fetchRelationships,
  fetchRelationship,
  fetchRelationshipViews,
  fetchRelationshipTypes,
  createRelationship,
  updateRelationship,
  deleteRelationship,
} from "./relationships"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("fetchRelationshipTypes", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns string array", async () => {
    mockFetchOk(["Association", "Realization"])
    const types = await fetchRelationshipTypes()
    expect(types).toContain("Association")
  })
})

describe("fetchRelationships", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches without filters", async () => {
    const result = await fetchRelationships()
    expect(Array.isArray(result)).toBe(true)
  })

  it("adds type query param", async () => {
    await fetchRelationships("Association")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("type=Association"),
      expect.any(Object)
    )
  })
})

describe("fetchRelationships with name param", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("passes name query param when provided", async () => {
    mockFetchOk([])
    await fetchRelationships(undefined, "MyRel")
    const url = vi.mocked(fetch).mock.calls[0]![0] as string
    expect(url).toContain("name=MyRel")
  })

  it("passes both type and name query params when both provided", async () => {
    mockFetchOk([])
    await fetchRelationships("Association", "Link")
    const url = vi.mocked(fetch).mock.calls[0]![0] as string
    expect(url).toContain("type=Association")
    expect(url).toContain("name=Link")
  })
})

describe("relationship detail helpers", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchRelationship returns relationship detail", async () => {
    mockFetchOk({
      identifier: "r1",
      name: null,
      type: "Association",
      source: "e1",
      target: "e2",
      documentation: null,
      properties: [],
    })
    const rel = await fetchRelationship("r1")
    expect(rel.identifier).toBe("r1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1"),
      expect.any(Object)
    )
  })

  it("fetchRelationshipViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1" }])
    const views = await fetchRelationshipViews("r1")
    expect(views[0]!.identifier).toBe("v1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1/views"),
      expect.any(Object)
    )
  })
})

describe("relationship mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createRelationship posts and returns relationship", async () => {
    mockFetchOk({
      identifier: "r1",
      name: "Rel",
      type: "Association",
      source: "e1",
      target: "e2",
      documentation: null,
      properties: [],
    })
    const rel = await createRelationship({
      type: "Association",
      source: "e1",
      target: "e2",
    })
    expect(rel.identifier).toBe("r1")
  })

  it("updateRelationship puts", async () => {
    mockFetchOk({
      identifier: "r1",
      name: "Updated",
      type: "Association",
      source: "e1",
      target: "e2",
      documentation: null,
      properties: [],
    })
    const rel = await updateRelationship("r1", { name: "Updated" })
    expect(rel.name).toBe("Updated")
  })

  it("deleteRelationship sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteRelationship("r1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
