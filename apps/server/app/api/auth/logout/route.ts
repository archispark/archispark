import { NextResponse, type NextRequest } from "next/server"
import { buildLogoutUrl } from "@workspace/auth"
import { clearAuthCookies } from "@/lib/auth-cookies"
import { getRequestOrigin } from "@/lib/request-origin"
import { revokeRefreshToken } from "@/lib/archimate/local-auth-tokens"

export const dynamic = "force-dynamic"

/**
 * Clears the session cookies and, for Keycloak sessions, redirects through
 * end-session (dispatched on the `auth_provider` cookie — a local session
 * just revokes its refresh token and goes straight to `/login`).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const postLogoutRedirectUri = new URL(
    "/login",
    getRequestOrigin(req)
  ).toString()

  if (req.cookies.get("auth_provider")?.value === "local") {
    const refreshToken = req.cookies.get("refresh_token")?.value
    if (refreshToken) await revokeRefreshToken(refreshToken)
    const res = NextResponse.redirect(postLogoutRedirectUri)
    clearAuthCookies(res, req)
    return res
  }

  const clientId = process.env.KEYCLOAK_CLIENT_ID_WEB
  const idToken = req.cookies.get("id_token")?.value

  const target = clientId
    ? buildLogoutUrl({ clientId, idToken, postLogoutRedirectUri })
    : postLogoutRedirectUri

  const res = NextResponse.redirect(target)
  clearAuthCookies(res, req)
  return res
}
