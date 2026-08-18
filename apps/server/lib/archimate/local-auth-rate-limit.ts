/**
 * Failed-login rate limiting for the local (username/password) auth flow —
 * Postgres-backed (`local_login_attempts`) rather than in-memory, since the
 * app may run as multiple serverless instances. Checked against both the
 * submitted username and the caller's IP, so a single compromised account
 * can't be brute-forced from one address, nor can one address spray many
 * accounts.
 */

import { and, eq, gte, sql } from "drizzle-orm"
import { db, localLoginAttempts } from "@workspace/db"
import type { NextRequest } from "next/server"

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 15 * 60

function now(): number {
  return Math.floor(Date.now() / 1000)
}

/** Best-effort client IP from `X-Forwarded-For` — absent behind no proxy, never trusted for anything but rate-limit bucketing. */
export function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for")
  return xff?.split(",")[0]?.trim() || null
}

function identifiersFor(username: string, ip: string | null): string[] {
  const ids = [`user:${username}`]
  if (ip) ids.push(`ip:${ip}`)
  return ids
}

/** True if either the username or the IP has hit the failed-attempt ceiling in the last 15 minutes. */
export async function isRateLimited(
  username: string,
  ip: string | null
): Promise<boolean> {
  const since = now() - WINDOW_SECONDS
  for (const identifier of identifiersFor(username, ip)) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(localLoginAttempts)
      .where(
        and(
          eq(localLoginAttempts.identifier, identifier),
          gte(localLoginAttempts.createdAt, since)
        )
      )
    if ((row?.n ?? 0) >= MAX_ATTEMPTS) return true
  }
  return false
}

/** Records a failed login attempt against both the username and the IP buckets. */
export async function recordFailedAttempt(
  username: string,
  ip: string | null
): Promise<void> {
  const identifiers = identifiersFor(username, ip)
  await db
    .insert(localLoginAttempts)
    .values(identifiers.map((identifier) => ({ identifier })))
}
