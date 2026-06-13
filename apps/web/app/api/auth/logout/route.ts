import { NextResponse, type NextRequest } from "next/server";
import { buildLogoutUrl } from "@workspace/auth";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/** Clears the local session cookies and redirects through Keycloak end-session. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const clientId = process.env.KEYCLOAK_CLIENT_ID_WEB;
  const idToken = req.cookies.get("id_token")?.value;
  const postLogoutRedirectUri = new URL("/login", getRequestOrigin(req)).toString();

  const target = clientId
    ? buildLogoutUrl({ clientId, idToken, postLogoutRedirectUri })
    : postLogoutRedirectUri;

  const res = NextResponse.redirect(target);
  clearAuthCookies(res, req);
  return res;
}
