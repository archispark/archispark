import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendMailMock = vi.fn()
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }))
vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}))

const {
  isHoneypotFilled,
  sendContactEmail,
  validateContactPayload,
} = await import("./contact")

describe("validateContactPayload", () => {
  it("returns no errors for a complete payload", () => {
    expect(
      validateContactPayload({
        name: "Ada",
        email: "ada@example.com",
        message: "Hello",
      })
    ).toEqual({})
  })

  it("flags missing name, invalid email and missing message", () => {
    const errors = validateContactPayload({
      name: "  ",
      email: "not-an-email",
      message: "",
    })
    expect(errors.name).toBeDefined()
    expect(errors.email).toBeDefined()
    expect(errors.message).toBeDefined()
  })
})

describe("isHoneypotFilled", () => {
  it("is false when the honeypot field is empty", () => {
    expect(isHoneypotFilled({ company: "" })).toBe(false)
    expect(isHoneypotFilled({})).toBe(false)
  })

  it("is true when the honeypot field is filled", () => {
    expect(isHoneypotFilled({ company: "Acme" })).toBe(true)
  })
})

describe("sendContactEmail", () => {
  const payload = { name: "Ada", email: "ada@example.com", message: "Hi" }

  beforeEach(() => {
    sendMailMock.mockReset()
    process.env["SMTP_HOST"] = "smtp.ovh.net"
    process.env["SMTP_PORT"] = "587"
    process.env["SMTP_USER"] = "contact@archispark.io"
    process.env["SMTP_PASSWORD"] = "secret"
    process.env["SMTP_FROM"] = "no-reply@archispark.io"
    process.env["CONTACT_TO_EMAIL"] = "contact@archispark.io"
  })

  afterEach(() => {
    delete process.env["SMTP_HOST"]
    delete process.env["SMTP_PORT"]
    delete process.env["SMTP_USER"]
    delete process.env["SMTP_PASSWORD"]
    delete process.env["SMTP_FROM"]
    delete process.env["CONTACT_TO_EMAIL"]
  })

  it("sends through the SMTP transport with the sender's address as reply-to", async () => {
    sendMailMock.mockResolvedValue({})
    await sendContactEmail(payload)
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "contact@archispark.io",
        from: "no-reply@archispark.io",
        replyTo: "ada@example.com",
      })
    )
  })

  it("propagates an SMTP send failure", async () => {
    sendMailMock.mockRejectedValue(new Error("boom"))
    await expect(sendContactEmail(payload)).rejects.toThrow("boom")
  })

  it("throws when CONTACT_TO_EMAIL is missing", async () => {
    delete process.env["CONTACT_TO_EMAIL"]
    await expect(sendContactEmail(payload)).rejects.toThrow(
      "CONTACT_TO_EMAIL"
    )
  })

  it("throws when SMTP_HOST is missing", async () => {
    delete process.env["SMTP_HOST"]
    await expect(sendContactEmail(payload)).rejects.toThrow("SMTP_HOST")
  })
})
