import { NextResponse, type NextRequest } from "next/server";
import { refreshTokens } from "@workspace/auth";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth-cookies";

export const dynamic = "force-dynamic";

/** Exchanges the refresh token cookie for a fresh access/refresh token pair. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientId = process.env.KEYCLOAK_CLIENT_ID_ADMIN_WEB;
  const refreshToken = req.cookies.get("refresh_token")?.value;

  if (!clientId || !refreshToken) {
    const res = new NextResponse(null, { status: 401 });
    clearAuthCookies(res, req);
    return res;
  }

  try {
    const tokens = await refreshTokens({ clientId, refreshToken });
    const res = new NextResponse(null, { status: 204 });
    setAuthCookies(res, req, tokens);
    return res;
  } catch {
    const res = new NextResponse(null, { status: 401 });
    clearAuthCookies(res, req);
    return res;
  }
}
