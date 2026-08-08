import type { NextRequest } from "next/server"
import { requireAuth, requireSuperAdmin } from "@/lib/archimate/auth"
import type { AuthContext } from "@/lib/archimate/access"

/**
 * Wraps a Route Handler with authentication — resolves the caller (Bearer
 * personal token, Bearer Keycloak JWT, or `access_token` cookie) and passes
 * it as `auth`. Throws `UnauthorizedError`, so compose with
 * `withErrorHandling` (outermost) to turn that into a 401 response:
 * `withErrorHandling(withAuth(handler))`.
 */
export function withAuth<Args extends unknown[]>(
  handler: (
    req: NextRequest,
    auth: AuthContext,
    ...args: Args
  ) => Promise<Response>
): (req: NextRequest, ...args: Args) => Promise<Response> {
  return async (req, ...args) => {
    const auth = await requireAuth(req)
    return handler(req, auth, ...args)
  }
}

/** Like `withAuth`, but also rejects anyone who isn't `platform_admin`. */
export function withSuperAdmin<Args extends unknown[]>(
  handler: (
    req: NextRequest,
    auth: AuthContext,
    ...args: Args
  ) => Promise<Response>
): (req: NextRequest, ...args: Args) => Promise<Response> {
  return async (req, ...args) => {
    const auth = await requireSuperAdmin(req)
    return handler(req, auth, ...args)
  }
}
