/**
 * Tests for local-auth-rate-limit.ts — the 5-attempts/15-minute failed
 * login ceiling, keyed by both username and IP.
 */

import { describe, it, expect } from "vitest"
import { randomUUID } from "crypto"
import { isRateLimited, recordFailedAttempt } from "./local-auth-rate-limit"

describe("isRateLimited / recordFailedAttempt", () => {
  it("is not rate limited before any failed attempt", async () => {
    const username = `rl-${randomUUID()}`
    expect(await isRateLimited(username, "10.0.0.1")).toBe(false)
  })

  it("rate limits after 5 failed attempts for the same username", async () => {
    const username = `rl-${randomUUID()}`
    for (let i = 0; i < 5; i++) await recordFailedAttempt(username, null)
    expect(await isRateLimited(username, null)).toBe(true)
  })

  it("rate limits by IP even across different usernames", async () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`
    for (let i = 0; i < 5; i++)
      await recordFailedAttempt(`rl-${randomUUID()}`, ip)
    expect(await isRateLimited(`rl-${randomUUID()}`, ip)).toBe(true)
  })

  it("does not rate limit under the threshold", async () => {
    const username = `rl-${randomUUID()}`
    for (let i = 0; i < 4; i++) await recordFailedAttempt(username, null)
    expect(await isRateLimited(username, null)).toBe(false)
  })
})
