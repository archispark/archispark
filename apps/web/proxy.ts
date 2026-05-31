import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
  // Better Auth prefixes the session cookie with `__Secure-` (or `__Host-`)
  // when the request reaches the API over HTTPS — typical behind a TLS reverse
  // proxy. Match on the unprefixed suffix so both local HTTP and remote HTTPS work.
  const token = req.cookies
    .getAll()
    .find(
      (c) =>
        c.name === "better-auth.session_token" ||
        c.name === "better-auth.session_data" ||
        c.name.endsWith("-better-auth.session_token") ||
        c.name.endsWith("-better-auth.session_data"),
    )?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
