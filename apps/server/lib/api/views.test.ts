import { describe, it, expect, afterEach, vi } from "vitest"
import {
  viewImageUrl,
  fetchViews,
  fetchView,
  fetchViewpoints,
  createView,
  updateView,
  deleteView,
  createViewNode,
  updateViewNode,
  deleteViewNode,
  createViewConnection,
  updateViewConnection,
  deleteViewConnection,
} from "./views"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

function mockFetchError(status = 500) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ detail: `HTTP ${status}` }),
    })
  )
}

describe("viewImageUrl", () => {
  it("generates SVG URL by default", () => {
    const url = viewImageUrl("view-1")
    expect(url).toContain("view-1")
    expect(url).toContain("format=svg")
  })

  it("encodes special characters in id", () => {
    const url = viewImageUrl("view/with spaces")
    expect(url).not.toContain(" ")
  })
})

describe("fetchViewpoints", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchViewpoints returns array", async () => {
    mockFetchOk(["Layered", "Application Usage"])
    const vps = await fetchViewpoints()
    expect(vps).toContain("Layered")
  })
})

describe("fetchViews / fetchView", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1", documentation: null }])
    const views = await fetchViews()
    expect(views[0]!.identifier).toBe("v1")
  })

  it("fetchView returns view detail", async () => {
    mockFetchOk({
      identifier: "v1",
      name: "View 1",
      documentation: null,
      nodes: [],
      connections: [],
    })
    const v = await fetchView("v1")
    expect(v.identifier).toBe("v1")
    expect(v.nodes).toEqual([])
  })

  it("throws API error on non-ok GET", async () => {
    mockFetchError(404)
    await expect(fetchViews()).rejects.toThrow("API error: 404")
  })
})

describe("view mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createView posts and returns view", async () => {
    mockFetchOk({ identifier: "v1", name: "New View", documentation: null })
    const v = await createView({ name: "New View" })
    expect(v.identifier).toBe("v1")
  })

  it("updateView puts", async () => {
    mockFetchOk({ identifier: "v1", name: "Renamed", documentation: null })
    const v = await updateView("v1", { name: "Renamed" })
    expect(v.name).toBe("Renamed")
  })

  it("deleteView sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteView("v1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})

describe("view node mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createViewNode posts to /views/:id/nodes", async () => {
    mockFetchOk({
      identifier: "n1",
      element_ref: "e1",
      x: 10,
      y: 20,
      w: 120,
      h: 60,
      name: null,
      children: [],
    })
    const n = await createViewNode("v1", {
      element_id: "e1",
      x: 10,
      y: 20,
      w: 120,
      h: 60,
    })
    expect(n.identifier).toBe("n1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/nodes"),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("updateViewNode puts to /views/:id/nodes/:nid", async () => {
    mockFetchOk({
      identifier: "n1",
      element_ref: "e1",
      x: 50,
      y: 60,
      w: 120,
      h: 60,
      name: null,
      children: [],
    })
    const n = await updateViewNode("v1", "n1", { x: 50, y: 60 })
    expect(n.x).toBe(50)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/nodes/n1"),
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("deleteViewNode sends DELETE to /views/:id/nodes/:nid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteViewNode("v1", "n1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/nodes/n1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})

describe("view connection mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createViewConnection posts to /views/:id/connections", async () => {
    mockFetchOk({
      identifier: "c1",
      source: "n1",
      target: "n2",
      name: null,
      relationship_ref: null,
    })
    const c = await createViewConnection("v1", { source: "n1", target: "n2" })
    expect(c.identifier).toBe("c1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/connections"),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("updateViewConnection puts to /views/:id/connections/:cid", async () => {
    mockFetchOk({
      identifier: "c1",
      source: "n1",
      target: "n2",
      name: "Flow",
      relationship_ref: null,
    })
    const c = await updateViewConnection("v1", "c1", { name: "Flow" })
    expect(c.name).toBe("Flow")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/connections/c1"),
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("deleteViewConnection sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteViewConnection("v1", "c1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1/connections/c1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
