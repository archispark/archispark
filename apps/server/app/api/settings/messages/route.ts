import { NextResponse, type NextRequest } from "next/server"
import { eq, sql } from "drizzle-orm"
import { db, siteSettings } from "@workspace/db"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withSuperAdmin } from "@/lib/http/with-auth"

export const dynamic = "force-dynamic"

/** Login banner — the one route that's public even below `requireAuth` in the old Express app. */
export async function GET(): Promise<NextResponse> {
  const defaults = {
    login_message: null,
    login_message_enabled: false,
    banner_message: null,
    banner_message_enabled: false,
  }
  try {
    const [row] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    if (!row) return NextResponse.json(defaults)
    return NextResponse.json({
      login_message: row.loginMessage ?? null,
      login_message_enabled: row.loginMessageEnabled,
      banner_message: row.bannerMessage ?? null,
      banner_message_enabled: row.bannerMessageEnabled,
    })
  } catch {
    return NextResponse.json(defaults)
  }
}

export const PUT = withErrorHandling(
  withSuperAdmin(async (req: NextRequest) => {
    const {
      login_message,
      login_message_enabled,
      banner_message,
      banner_message_enabled,
    } = (await req.json()) as Record<string, unknown>
    const vals = {
      id: 1 as const,
      loginMessage:
        typeof login_message === "string" ? login_message || null : null,
      loginMessageEnabled: Boolean(login_message_enabled),
      bannerMessage:
        typeof banner_message === "string" ? banner_message || null : null,
      bannerMessageEnabled: Boolean(banner_message_enabled),
      updatedAt: sql`extract(epoch from now())::int`,
    }
    await db
      .insert(siteSettings)
      .values(vals)
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          loginMessage: vals.loginMessage,
          loginMessageEnabled: vals.loginMessageEnabled,
          bannerMessage: vals.bannerMessage,
          bannerMessageEnabled: vals.bannerMessageEnabled,
          updatedAt: vals.updatedAt,
        },
      })
    return NextResponse.json({ ok: true })
  })
)
