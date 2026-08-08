import { NextResponse, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db, apiTokens } from "@workspace/db"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { parseIntParam } from "@/lib/http/params"
import { NotFoundError, ForbiddenError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"

export const DELETE = withErrorHandling(
  withAuth(
    async (
      _req: NextRequest,
      auth,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const id = parseIntParam((await params).id)
      const [existing] = await db
        .select({ userId: apiTokens.userId })
        .from(apiTokens)
        .where(eq(apiTokens.id, id))
      if (!existing) throw new NotFoundError("Token introuvable.")
      if (
        auth.user.role !== "platform_admin" &&
        existing.userId !== auth.user.id
      )
        throw new ForbiddenError("Accès refusé.")
      await db.delete(apiTokens).where(eq(apiTokens.id, id))
      return new NextResponse(null, { status: 204 })
    }
  )
)
