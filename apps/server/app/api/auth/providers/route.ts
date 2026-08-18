import { NextResponse } from "next/server"
import { isKeycloakSsoEnabled } from "@workspace/auth"

export const dynamic = "force-dynamic"

/** Public, unauthenticated — tells the login page whether to offer the Keycloak SSO button alongside the local username/password form. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    keycloakSsoEnabled: isKeycloakSsoEnabled(),
    keycloakProviderName: process.env.KEYCLOAK_SSO_PROVIDER_NAME || "Keycloak",
  })
}
