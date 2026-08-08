import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { ValidationError } from "@/lib/archimate/errors"
import { ExploreQueryError, runExploreQuery } from "@/lib/dashboards/explore"

export const dynamic = "force-dynamic"

interface ExploreRequestBody {
  query?: unknown
  parameters?: unknown
}

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    const { organizationId } = await resolveActiveContext(auth.user, "read", auth.tokenContext)
    const body = (await req.json()) as ExploreRequestBody
    if (typeof body.query !== "string") throw new ValidationError("« query » est obligatoire.")
    if (!body.parameters || typeof body.parameters !== "object" || Array.isArray(body.parameters)) {
      throw new ValidationError("« parameters » doit être un objet JSON.")
    }
    try {
      const result = await runExploreQuery(body.query, body.parameters as Record<string, unknown>, organizationId)
      return NextResponse.json(result)
    } catch (error) {
      if (error instanceof ExploreQueryError) throw new ValidationError(error.message)
      throw error
    }
  })
)
