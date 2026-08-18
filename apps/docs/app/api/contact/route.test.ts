import { describe, expect, it, vi, beforeEach } from "vitest"

const sendContactEmailMock = vi.fn()
vi.mock("@/lib/contact", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contact")>(
    "@/lib/contact"
  )
  return { ...actual, sendContactEmail: sendContactEmailMock }
})

const { POST } = await import("./route")

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    sendContactEmailMock.mockReset()
  })

  it("sends the email and returns ok for a valid payload", async () => {
    sendContactEmailMock.mockResolvedValue(undefined)
    const response = await POST(
      jsonRequest({
        name: "Ada",
        email: "ada@example.com",
        message: "Hello",
        company: "",
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(sendContactEmailMock).toHaveBeenCalledWith({
      name: "Ada",
      email: "ada@example.com",
      message: "Hello",
    })
  })

  it("rejects an invalid payload without sending an email", async () => {
    const response = await POST(
      jsonRequest({ name: "", email: "bad", message: "" })
    )
    expect(response.status).toBe(422)
    expect(sendContactEmailMock).not.toHaveBeenCalled()
  })

  it("silently accepts a honeypot submission without sending an email", async () => {
    const response = await POST(
      jsonRequest({
        name: "Bot",
        email: "bot@example.com",
        message: "spam",
        company: "filled-by-bot",
      })
    )
    expect(response.status).toBe(200)
    expect(sendContactEmailMock).not.toHaveBeenCalled()
  })

  it("returns 502 when sending fails", async () => {
    sendContactEmailMock.mockRejectedValue(new Error("boom"))
    const response = await POST(
      jsonRequest({
        name: "Ada",
        email: "ada@example.com",
        message: "Hello",
      })
    )
    expect(response.status).toBe(502)
  })

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: "{not json",
      })
    )
    expect(response.status).toBe(400)
  })
})
