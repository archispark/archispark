/**
 * Deterministic fake "access tokens" for the control-api test suite.
 *
 * There is no real Keycloak instance in the test environment, so the real
 * `verifyAccessToken` (JWKS-based JWT verification) always returns `null`.
 * `fakeVerifyAccessToken` decodes a base64url-encoded JSON `KeycloakClaims`
 * object instead of verifying a real JWT signature; `makeFakeAccessToken`
 * builds the matching token string. Spread
 * `verifyAccessToken: vi.fn().mockImplementation(fakeVerifyAccessToken)` into
 * a `vi.mock("@workspace/auth", ...)` factory's return value so per-test
 * `mockResolvedValueOnce`/`mockRejectedValueOnce` overrides still work.
 */
import type { KeycloakClaims } from "@workspace/auth";

// Mirrors apps/control-api/src/auth.ts's DEMO_KEYCLOAK_SUBS — defined locally
// (not imported) to avoid a circular import when this module is itself used
// to build a `vi.mock("@workspace/auth", ...)` factory.
export const DEMO_KEYCLOAK_SUBS = {
  admin:   "c8a1f6c0-0000-4000-8000-000000000001",
  user:    "c8a1f6c0-0000-4000-8000-000000000002",
  contrib: "c8a1f6c0-0000-4000-8000-000000000003",
  archi:   "c8a1f6c0-0000-4000-8000-000000000004",
} as const;

export function makeFakeAccessToken(claims: KeycloakClaims): string {
  return Buffer.from(JSON.stringify(claims)).toString("base64url");
}

export async function fakeVerifyAccessToken(token: string): Promise<KeycloakClaims | null> {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as KeycloakClaims;
  } catch {
    return null;
  }
}
