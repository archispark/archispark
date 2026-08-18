import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "./local-password.js"

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple")
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(
      true
    )
  })

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple")
    expect(await verifyPassword(hash, "wrong password")).toBe(false)
  })

  it("produces an argon2id-encoded hash", async () => {
    const hash = await hashPassword("correct horse battery staple")
    expect(hash.startsWith("$argon2id$")).toBe(true)
  })

  it("returns false instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false)
  })
})
