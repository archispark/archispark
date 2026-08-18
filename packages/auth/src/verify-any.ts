import { decodeJwt } from "jose"
import { verifyAccessToken, type KeycloakClaims } from "./verify.js"
import { verifyLocalAccessToken, LOCAL_JWT_ISSUER } from "./local-jwt.js"

/**
 * Verifies an access token regardless of its source (local or Keycloak),
 * routing on the unverified `iss` claim — the signature/issuer are still
 * fully checked by the matching verifier before any claim is trusted.
 * Returns `null` for any invalid, expired, or unrecognized token.
 */
export async function verifyAnyAccessToken(
  token: string
): Promise<KeycloakClaims | null> {
  let iss: string | undefined
  try {
    iss = decodeJwt(token).iss
  } catch {
    return null
  }
  return iss === LOCAL_JWT_ISSUER
    ? verifyLocalAccessToken(token)
    : verifyAccessToken(token)
}
