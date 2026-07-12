import {
  DEMO_KEYCLOAK_SUBS,
  makeFakeAccessToken,
} from "./test/keycloak-token-fake.js"

export const TEST_USER_ID = DEMO_KEYCLOAK_SUBS.admin

/** Mints a fake Keycloak access token for the primary test user (regular "user" role). */
export function getAdminToken(): string {
  return makeFakeAccessToken({ sub: TEST_USER_ID, preferred_username: "admin" })
}

/** Mints a fake Keycloak access token for a second, distinct test user — used to verify workspace ownership isolation. */
export function getSecondUserToken(): string {
  return makeFakeAccessToken({
    sub: DEMO_KEYCLOAK_SUBS.user,
    preferred_username: "user",
  })
}

/** Mints a fake Keycloak access token carrying the platform_admin realm role. */
export function getPlatformAdminToken(): string {
  return makeFakeAccessToken({
    sub: DEMO_KEYCLOAK_SUBS.admin,
    preferred_username: "admin",
    realm_access: { roles: ["platform_admin"] },
  })
}

/** Mints a fake Keycloak access token for any of the demo accounts (admin/user/contrib/archi), regular "user" platform role. */
export function getTokenFor(username: keyof typeof DEMO_KEYCLOAK_SUBS): string {
  return makeFakeAccessToken({
    sub: DEMO_KEYCLOAK_SUBS[username],
    preferred_username: username,
  })
}
