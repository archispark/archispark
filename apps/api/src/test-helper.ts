import { DEMO_KEYCLOAK_SUBS, makeFakeAccessToken } from "./test/keycloak-token-fake.js";

export const TEST_USER_ID = DEMO_KEYCLOAK_SUBS.admin;

/** Mints a fake Keycloak access token for the primary test user (regular "user" role). */
export function getAdminToken(): string {
  return makeFakeAccessToken({ sub: TEST_USER_ID, preferred_username: "admin" });
}

/** Mints a fake Keycloak access token for a second, distinct test user — used to verify workspace ownership isolation. */
export function getSecondUserToken(): string {
  return makeFakeAccessToken({ sub: DEMO_KEYCLOAK_SUBS.user, preferred_username: "user" });
}
