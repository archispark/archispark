import { NextResponse, type NextRequest } from "next/server"
import { AppError } from "@/lib/archimate/errors"

/**
 * Wraps a Route Handler so any thrown `AppError` (or unknown error) becomes
 * a JSON `{ detail }` response — the single error-handling point that used
 * to be `apps/api/src/app.ts`'s global Express error middleware.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (req: NextRequest, ...args: Args) => Promise<Response>
): (req: NextRequest, ...args: Args) => Promise<Response> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args)
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          { detail: err.message },
          { status: err.statusCode }
        )
      }
      console.error("[api] unhandled request error", {
        method: req.method,
        url: req.url,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      const detail =
        err instanceof Error ? err.message : "Erreur interne du serveur."
      return NextResponse.json({ detail }, { status: 500 })
    }
  }
}
