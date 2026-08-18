export interface KeycloakConfig {
  /** Base URL of the Keycloak server, e.g. http://localhost:8080 */
  url: string
  /** Realm name, e.g. archispark */
  realm: string
}

/**
 * Reads the Keycloak connection settings from the environment.
 * Throws if KEYCLOAK_URL or KEYCLOAK_REALM is missing or empty.
 */
export function getKeycloakConfig(): KeycloakConfig {
  const url = process.env["KEYCLOAK_URL"]
  const realm = process.env["KEYCLOAK_REALM"]
  if (!url) throw new Error("KEYCLOAK_URL is not set")
  if (!realm) throw new Error("KEYCLOAK_REALM is not set")
  return { url, realm }
}

/**
 * Whether Keycloak SSO is offered as a sign-in option alongside the local
 * username/password accounts (`@workspace/auth`'s `local-jwt`/`local-password`).
 * Unlike `getKeycloakConfig`, this never throws — Keycloak is optional now
 * that local accounts are the default auth method.
 */
export function isKeycloakSsoEnabled(): boolean {
  return process.env["KEYCLOAK_SSO_ENABLED"] === "true"
}
