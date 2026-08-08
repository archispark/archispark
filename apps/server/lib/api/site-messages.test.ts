import { describe, it, expect, afterEach, vi } from "vitest"
import { fetchSiteMessages, updateSiteMessages } from "./site-messages"

function mockFetchOk(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data })
  )
}

describe("site messages", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetchSiteMessages returns site messages", async () => {
    mockFetchOk({
      login_message: "Welcome",
      login_message_enabled: true,
      banner_message: null,
      banner_message_enabled: false,
    })
    const msgs = await fetchSiteMessages()
    expect(msgs.login_message).toBe("Welcome")
  })

  it("updateSiteMessages puts and returns ok", async () => {
    mockFetchOk({ ok: true })
    const res = await updateSiteMessages({
      login_message: "Hi",
      login_message_enabled: false,
      banner_message: null,
      banner_message_enabled: false,
    })
    expect(res.ok).toBe(true)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/settings/messages"),
      expect.objectContaining({ method: "PUT" })
    )
  })
})
