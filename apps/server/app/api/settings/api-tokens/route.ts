import { randomUUID } from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db, apiTokens, workspaces } from "@workspace/db"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { assertOrgAccess } from "@/lib/archimate/access"
import { parseBody, ApiTokenCreateSchema } from "@/lib/archimate/validation"
import { ForbiddenError, ValidationError } from "@/lib/archimate/errors"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(
  withAuth(async (_req: NextRequest, auth) => {
    const isPlatformAdmin = auth.user.role === "platform_admin"
    const cols = {
      id: apiTokens.id,
      name: apiTokens.name,
      userId: apiTokens.userId,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      organizationId: apiTokens.organizationId,
      workspaceId: apiTokens.workspaceId,
    }
    const rows = isPlatformAdmin
      ? await db.select(cols).from(apiTokens)
      : await db
          .select(cols)
          .from(apiTokens)
          .where(eq(apiTokens.userId, auth.user.id))
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        user_id: r.userId,
        created_at: r.createdAt,
        last_used_at: r.lastUsedAt ?? null,
        expires_at: r.expiresAt ?? null,
        // platform_admin sees every token's bookkeeping columns but never the
        // organization/workspace scoping — that would leak organization
        // structure to a role that has no access to organization data (access.ts).
        ...(isPlatformAdmin
          ? {}
          : {
              organization_id: String(r.organizationId),
              workspace_id:
                r.workspaceId !== null ? String(r.workspaceId) : null,
            }),
      }))
    )
  })
)

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    // A personal token freezes a scope on creation; platform_admin's access
    // is deliberately the opposite — dynamic, chosen per session via admin
    // mode (see access.ts) — so it must not be able to mint a token that
    // would carry full owner-equivalent access to an arbitrary organization
    // indefinitely, independent of that session.
    if (auth.user.role === "platform_admin")
      throw new ForbiddenError(
        "Les comptes administrateurs plateforme ne peuvent pas créer de jetons personnels."
      )

    const body = parseBody(ApiTokenCreateSchema, await req.json())

    const organizationId = parseInt(body.organization_id, 10)
    if (!Number.isFinite(organizationId))
      throw new ValidationError("organization_id invalide.")
    // The caller must be a member of the organization the token is scoped to —
    // any role suffices ("read"); the role itself is re-resolved live on every
    // request the token makes (see access.ts), never frozen on the token.
    await assertOrgAccess(auth.user, organizationId, "read")

    let workspaceId: number | null = null
    if (body.workspace_id) {
      workspaceId = parseInt(body.workspace_id, 10)
      if (!Number.isFinite(workspaceId))
        throw new ValidationError("workspace_id invalide.")
      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.id, workspaceId),
            eq(workspaces.organizationId, organizationId)
          )
        )
      if (!ws)
        throw new ValidationError(
          "workspace_id invalide pour cette organisation."
        )
    }

    const expiresAt: number | undefined = (() => {
      if (body.expires_at === null || body.expires_at === undefined)
        return undefined
      const v =
        typeof body.expires_at === "string"
          ? parseInt(body.expires_at, 10)
          : body.expires_at
      return isNaN(v) ? undefined : v
    })()
    const token =
      randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")
    const [row] = await db
      .insert(apiTokens)
      .values({
        token,
        name: body.name.trim(),
        userId: auth.user.id,
        organizationId,
        workspaceId,
        expiresAt,
      })
      .returning({
        id: apiTokens.id,
        name: apiTokens.name,
        userId: apiTokens.userId,
        createdAt: apiTokens.createdAt,
        expiresAt: apiTokens.expiresAt,
        organizationId: apiTokens.organizationId,
        workspaceId: apiTokens.workspaceId,
      })
    return NextResponse.json(
      {
        id: row!.id,
        name: row!.name,
        user_id: row!.userId,
        created_at: row!.createdAt,
        expires_at: row!.expiresAt ?? null,
        organization_id: String(row!.organizationId),
        workspace_id:
          row!.workspaceId !== null ? String(row!.workspaceId) : null,
        token,
      },
      { status: 201 }
    )
  })
)
