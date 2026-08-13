import { hash, verify } from "@node-rs/argon2"

// OWASP-recommended minimums for argon2id (2024 cheat sheet).
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

/** Hashes a password with argon2id. No length/complexity check here — see MIN/MAX_PASSWORD_LENGTH for the policy enforced at the API boundary. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

/**
 * Verifies a password against an argon2id hash. Returns `false` (never
 * throws) on a malformed hash, so callers can safely compare against a
 * placeholder hash for unknown users without a try/catch.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}
