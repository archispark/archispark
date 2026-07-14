import { describe, it, expect, afterEach, vi } from "vitest"
import {
  fetchPropertyDefinitions,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
} from "./properties"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("fetchPropertyDefinitions", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns definitions", async () => {
    mockFetchOk([{ identifier: "pd1", name: "Cost", type: "string" }])
    const defs = await fetchPropertyDefinitions()
    expect(defs[0]!.identifier).toBe("pd1")
  })
})

describe("property definition mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("createPropertyDefinition posts", async () => {
    mockFetchOk({ identifier: "pd1", name: "Cost", type: "string" })
    const pd = await createPropertyDefinition({ name: "Cost" })
    expect(pd.identifier).toBe("pd1")
  })

  it("updatePropertyDefinition puts", async () => {
    mockFetchOk({ identifier: "pd1", name: "Updated", type: "string" })
    const pd = await updatePropertyDefinition("pd1", { name: "Updated" })
    expect(pd.name).toBe("Updated")
  })

  it("deletePropertyDefinition sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deletePropertyDefinition("pd1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/property-definitions/pd1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
