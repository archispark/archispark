import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@workspace/auth";

export const dynamic = "force-dynamic";

/** Returns the current user's identity derived from the `access_token` cookie. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ detail: "Non authentifié." }, { status: 401 });
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    return NextResponse.json({ detail: "Non authentifié." }, { status: 401 });
  }

  const role = claims.realm_access?.roles?.includes("platform_admin") ? "platform_admin" : "user";

  return NextResponse.json({
    id: claims.sub,
    username: claims.preferred_username ?? claims.sub,
    name: claims.name ?? claims.preferred_username ?? claims.sub,
    email: claims.email ?? null,
    role,
  });
}
