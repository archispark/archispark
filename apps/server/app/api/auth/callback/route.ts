import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@workspace/auth";
import { clearOidcFlowCookies, setAuthCookies } from "@/lib/auth-cookies";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/** Completes the Keycloak authorization-code + PKCE login flow. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const clientId = process.env.KEYCLOAK_CLIENT_ID_WEB;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("oidc_state")?.value;
  const verifier = req.cookies.get("pkce_verifier")?.value;
  const redirectTo = req.cookies.get("auth_redirect")?.value ?? "/";

  const origin = getRequestOrigin(req);

  if (!clientId || !code || !state || !verifier || state !== expectedState) {
    const res = NextResponse.redirect(new URL("/login", origin));
    clearOidcFlowCookies(res, req);
    return res;
  }

  const redirectUri = new URL("/api/auth/callback", origin).toString();

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ clientId, redirectUri, code, codeVerifier: verifier });
  } catch {
    const res = NextResponse.redirect(new URL("/login", origin));
    clearOidcFlowCookies(res, req);
    return res;
  }

  const res = NextResponse.redirect(new URL(redirectTo, origin));
  setAuthCookies(res, req, tokens);
  clearOidcFlowCookies(res, req);
  return res;
}
