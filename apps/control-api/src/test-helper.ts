import { listOrganizations } from "@workspace/auth";
import { initOrganizations, getMembershipContext } from "./auth.js";
import type { WorkspaceContext } from "./auth.js";
import { DEMO_KEYCLOAK_SUBS, makeFakeAccessToken } from "./test/keycloak-token-fake.js";

let initPromise: Promise<void> | null = null;
let adminCookie: string | null = null;
let userCookie: string | null = null;
let contribCookie: string | null = null;
let defaultOrgId: string | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = initOrganizations();
  return initPromise;
}

/** The id of the default Phasetwo organization seeded by initOrganizations(). */
export async function getDefaultOrgId(): Promise<string> {
  if (defaultOrgId) return defaultOrgId;
  await ensureInit();
  const [org] = await listOrganizations();
  if (!org?.id) throw new Error("No organization found.");
  defaultOrgId = org.id;
  return defaultOrgId;
}

/** A `Cookie` header value carrying a fake Keycloak access_token for the demo "admin" user (org owner, platform_admin). */
export async function getAdminCookie(): Promise<string> {
  if (adminCookie) return adminCookie;
  const orgId = await getDefaultOrgId();
  const token = makeFakeAccessToken({
    sub: DEMO_KEYCLOAK_SUBS.admin,
    preferred_username: "admin",
    realm_access: { roles: ["platform_admin"] },
    organizations: { [orgId]: { name: "Default", roles: ["owner"] } },
  });
  adminCookie = `access_token=${token}`;
  return adminCookie;
}

/** A `Cookie` header value carrying a fake Keycloak access_token for the demo "user" user (org member, no platform role). */
export async function getUserCookie(): Promise<string> {
  if (userCookie) return userCookie;
  const orgId = await getDefaultOrgId();
  const token = makeFakeAccessToken({
    sub: DEMO_KEYCLOAK_SUBS.user,
    preferred_username: "user",
    organizations: { [orgId]: { name: "Default", roles: ["member"] } },
  });
  userCookie = `access_token=${token}`;
  return userCookie;
}

/** A `Cookie` header value carrying a fake Keycloak access_token for the demo "contrib" user (org admin, no platform role). */
export async function getContribCookie(): Promise<string> {
  if (contribCookie) return contribCookie;
  const orgId = await getDefaultOrgId();
  const token = makeFakeAccessToken({
    sub: DEMO_KEYCLOAK_SUBS.contrib,
    preferred_username: "contrib",
    organizations: { [orgId]: { name: "Default", roles: ["admin"] } },
  });
  contribCookie = `access_token=${token}`;
  return contribCookie;
}

/** The admin user's id and organization membership context (org owner). */
export async function getAdminWorkspaceContext(): Promise<{ userId: string; ctx: WorkspaceContext }> {
  const orgId = await getDefaultOrgId();
  const ctx = await getMembershipContext(DEMO_KEYCLOAK_SUBS.admin, orgId);
  if (!ctx) throw new Error("Admin membership context not found.");
  return { userId: DEMO_KEYCLOAK_SUBS.admin, ctx };
}
