import { describe, it, expect, afterEach, vi } from "vitest"
import { fetchApiTokens, createApiToken, deleteApiToken } from "./api-tokens"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("API token mutations", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchApiTokens returns token list", async () => {
    mockFetchOk([
      {
        id: 1,
        name: "CI",
        user_id: "u1",
        created_at: 0,
        last_used_at: null,
        expires_at: null,
      },
    ])
    const tokens = await fetchApiTokens()
    expect(tokens[0]!.name).toBe("CI")
  })

  it("createApiToken posts without expiresAt", async () => {
    mockFetchOk({
      id: 2,
      name: "My Token",
      user_id: "u1",
      created_at: 0,
      last_used_at: null,
      expires_at: null,
      organization_id: "1",
      workspace_id: null,
      token: "tok-abc",
    })
    const t = await createApiToken("My Token", "1")
    expect(t.token).toBe("tok-abc")
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/api-tokens"),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("createApiToken posts with expiresAt (covers ?? branch)", async () => {
    mockFetchOk({
      id: 3,
      name: "Expiring",
      user_id: "u1",
      created_at: 0,
      last_used_at: null,
      expires_at: 9999,
      organization_id: "1",
      workspace_id: "2",
      token: "tok-exp",
    })
    const t = await createApiToken("Expiring", "1", "2", 9999)
    expect(t.expires_at).toBe(9999)
  })

  it("deleteApiToken sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    await deleteApiToken(1)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/api-tokens/1"),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
