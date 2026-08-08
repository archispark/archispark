import type { NextRequest } from "next/server";

/**
 * Returns the request's origin (scheme + host), derived from the `Host`
 * request header rather than `req.nextUrl.origin`. Next's dev server bound
 * to `--hostname 0.0.0.0` reports `nextUrl.origin` as `http://0.0.0.0:<port>`
 * regardless of the client's `Host` header, which breaks absolute redirect
 * URIs (e.g. the Keycloak `redirect_uri`). Falls back to `nextUrl.origin`
 * when no `Host` header is present.
 */
export function getRequestOrigin(req: NextRequest): string {
  const host = req.headers.get("host");
  return host ? `${req.nextUrl.protocol}//${host}` : req.nextUrl.origin;
}
