import { describe, it, expect, afterEach, vi } from "vitest"
import {
  fetchProviders,
  createProvider,
  updateProvider,
  deleteProvider,
} from "./oauth-providers"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("OAuth provider mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchProviders returns provider list", async () => {
    mockFetchOk([
      {
        id: "p1",
        provider_id: "google",
        type: "google",
        name: "Google",
        client_id: "cid",
        issuer_url: null,
        tenant_id: null,
        enabled: true,
        created_at: 0,
      },
    ])
    const providers = await fetchProviders()
    expect(providers[0]!.id).toBe("p1")
  })

  it("createProvider posts and returns provider", async () => {
    mockFetchOk({
      id: "p1",
      provider_id: "google",
      type: "google",
      name: "Google",
      client_id: "cid",
      issuer_url: null,
      tenant_id: null,
      enabled: true,
      created_at: 0,
    })
    const p = await createProvider({
      type: "google",
      name: "Google",
      client_id: "cid",
      client_secret: "secret",
    })
    expect(p.id).toBe("p1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/providers"),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("updateProvider puts and returns provider", async () => {
    mockFetchOk({
      id: "p1",
      provider_id: "google",
      type: "google",
      name: "Updated",
      client_id: "cid",
      issuer_url: null,
      tenant_id: null,
      enabled: true,
      created_at: 0,
    })
    const p = await updateProvider("p1", { name: "Updated" })
    expect(p.name).toBe("Updated")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/providers/p1"),
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("deleteProvider sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteProvider("p1")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/providers/p1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("updateProvider throws when PUT fails and json parse also fails (covers .catch branch)", async () => {
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
    await expect(updateProvider("p1", { name: "X" })).rejects.toThrow()
  })
})
