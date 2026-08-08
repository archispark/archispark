import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Liveness probe — no auth, no DB, used by Docker healthchecks. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" })
}
