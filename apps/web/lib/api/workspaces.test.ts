import { describe, it, expect, afterEach, vi } from "vitest"
import {
  fetchWorkspaces,
  createWorkspaceApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
  activateWorkspaceApi,
} from "./workspaces"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("fetchWorkspaces", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns workspace list", async () => {
    mockFetchOk([{ id: "ws1", name: "Default", path: "/data", active: true }])
    const ws = await fetchWorkspaces()
    expect(ws[0]!.name).toBe("Default")
  })
})

describe("workspace mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createWorkspaceApi posts", async () => {
    mockFetchOk({ id: "ws2", name: "New WS", path: "/data", active: false })
    const ws = await createWorkspaceApi({ name: "New WS" })
    expect(ws.name).toBe("New WS")
  })

  it("updateWorkspaceApi puts", async () => {
    mockFetchOk({ id: "ws2", name: "Renamed", path: "/data", active: false })
    const ws = await updateWorkspaceApi("ws2", { name: "Renamed" })
    expect(ws.name).toBe("Renamed")
  })

  it("deleteWorkspaceApi sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteWorkspaceApi("ws2")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/ws2"),
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("activateWorkspaceApi posts to activate endpoint", async () => {
    mockFetchOk({ id: "ws2", name: "WS", path: "/data", active: true })
    const ws = await activateWorkspaceApi("ws2")
    expect(ws.active).toBe(true)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/ws2/activate"),
      expect.any(Object)
    )
  })
})
