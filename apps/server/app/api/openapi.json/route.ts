import { NextResponse } from "next/server"
import { openApiSpec } from "@/lib/archimate/openapi"

export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(openApiSpec)
}
