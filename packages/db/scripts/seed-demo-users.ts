/**
 * Demo Keycloak users seed — creates/updates the demo accounts (admin, user,
 * contrib, archi) via the Keycloak Admin API from
 * .docker/keycloak/demo-users.json.
 *
 * Unlike .docker/keycloak/realm-export.json (consumed by `--import-realm` at
 * Keycloak container first-boot, local dev only), this works against any
 * Keycloak instance — including a hosted Phasetwo realm — and is idempotent
 * (safe to re-run; updates the password/role mappings of existing users).
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo-users
 *
 * Requires KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 * KEYCLOAK_ADMIN_CLIENT_SECRET (control-api's service account, with
 * manage-users/view-users on the target realm).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  findUserByUsername,
  createKeycloakUser,
  updateKeycloakUser,
  setUserPassword,
  getUserRealmRoles,
  assignRealmRole,
  listOrganizations,
  listOrgMembers,
  addOrgMember,
  ensureDefaultOrgRoles,
  setOrgMemberRoles,
  type OrgRoleName,
  type KeycloakUserRepresentation,
} from "@workspace/auth";

interface DemoUser extends KeycloakUserRepresentation {
  password: string;
  realmRoles?: string[];
  orgRole?: OrgRoleName;
}

const USERS_PATH = resolve(import.meta.dirname, "../../../.docker/keycloak/demo-users.json");
const users = JSON.parse(readFileSync(USERS_PATH, "utf-8")) as DemoUser[];

for (const { password, realmRoles, orgRole: _orgRole, ...rep } of users) {
  const existing = await findUserByUsername(rep.username);
  let userId: string;
  if (existing?.id) {
    await updateKeycloakUser(existing.id, rep);
    userId = existing.id;
    console.log(`Updated user ${rep.username} (${userId})`);
  } else {
    userId = await createKeycloakUser({ ...rep, enabled: true, emailVerified: true });
    console.log(`Created user ${rep.username} (${userId})`);
  }

  await setUserPassword(userId, password, false);

  if (realmRoles?.length) {
    const current = new Set((await getUserRealmRoles(userId)).map((r) => r.name));
    for (const role of realmRoles) {
      if (!current.has(role)) {
        await assignRealmRole(userId, role);
        console.log(`  + realm role "${role}"`);
      }
    }
  }
}

// Add demo users to the first Keycloak organization with their org role
const orgs = await listOrganizations();
const org = orgs[0];
if (org?.id) {
  await ensureDefaultOrgRoles(org.id);
  const members = await listOrgMembers(org.id);
  const memberIds = new Set(members.map((m) => m.id));
  for (const { username, realmRoles, orgRole } of users) {
    if (realmRoles?.includes("platform_admin") || !orgRole) continue;
    const u = await findUserByUsername(username);
    if (!u?.id) continue;
    if (!memberIds.has(u.id)) {
      await addOrgMember(org.id, u.id);
      console.log(`Added ${username} to organization "${org.name}"`);
    }
    await setOrgMemberRoles(org.id, u.id, orgRole);
    console.log(`  org role: ${orgRole}`);
  }
} else {
  console.warn("No organization found in Keycloak — skipping org membership step.");
}

console.log("Done.");
