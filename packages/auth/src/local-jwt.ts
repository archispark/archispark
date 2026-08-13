import { SignJWT, jwtVerify } from "jose"
import type { KeycloakClaims } from "./verify.js"

/** Dedicated issuer for locally-signed tokens — lets `verifyAnyAccessToken` route without a DB round-trip. */
export const LOCAL_JWT_ISSUER = "archispark-local"

export const LOCAL_ACCESS_TOKEN_TTL_SECONDS = 15 * 60

export interface LocalTokenUser {
  id: string
  username: string
  role: string
  email?: string
  emailVerified?: boolean
  displayName?: string
  mustChangePassword?: boolean
}

function getSecret(): Uint8Array {
  const secret = process.env["LOCAL_AUTH_JWT_SECRET"]
  if (!secret) throw new Error("LOCAL_AUTH_JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

/** Signs a local access token whose claims mirror `KeycloakClaims`, so downstream code (`requireAuth`) reads it identically to a Keycloak token. */
export async function signLocalAccessToken(
  user: LocalTokenUser
): Promise<string> {
  return new SignJWT({
    preferred_username: user.username,
    email: user.email,
    email_verified: user.emailVerified ?? false,
    name: user.displayName,
    realm_access: { roles: [user.role] },
    must_change_password: user.mustChangePassword ?? false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(LOCAL_JWT_ISSUER)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${LOCAL_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret())
}

/** Verifies a local access token (signature + issuer). Returns `null` if invalid/expired — same contract as `verifyAccessToken`. */
export async function verifyLocalAccessToken(
  token: string
): Promise<KeycloakClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: LOCAL_JWT_ISSUER,
    })
    return payload as unknown as KeycloakClaims
  } catch {
    return null
  }
}
