import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizationUrl, createPkcePair } from "@workspace/auth";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

const SHORT_LIVED_TTL = 300;

/** Starts the Keycloak authorization-code + PKCE login flow. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const clientId = process.env.KEYCLOAK_CLIENT_ID_ADMIN_WEB;
  if (!clientId) {
    return NextResponse.json({ detail: "KEYCLOAK_CLIENT_ID_ADMIN_WEB is not set" }, { status: 500 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const redirectTo = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";

  const { verifier, challenge } = createPkcePair();
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/callback", getRequestOrigin(req)).toString();

  const authUrl = buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge: challenge });

  const res = NextResponse.redirect(authUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SHORT_LIVED_TTL,
  };
  res.cookies.set("pkce_verifier", verifier, cookieOptions);
  res.cookies.set("oidc_state", state, cookieOptions);
  res.cookies.set("auth_redirect", redirectTo, cookieOptions);
  return res;
}
