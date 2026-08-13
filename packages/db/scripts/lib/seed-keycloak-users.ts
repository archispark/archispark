/**
 * Shared Keycloak user-seeding loop, used by both the full demo seed
 * (`seed-demo-users.ts`) and the minimal seed (`seed-minimal-users.ts`):
 * create-or-update each user via the Admin API, set its password, and
 * assign any missing realm roles. Idempotent (safe to re-run).
 */

import {
  findUserByUsername,
  createKeycloakUser,
  updateKeycloakUser,
  setUserPassword,
  getUserRealmRoles,
  assignRealmRole,
  type KeycloakUserRepresentation,
} from "@workspace/auth"

export interface SeedUser extends KeycloakUserRepresentation {
  password: string
  realmRoles?: string[]
}

export async function seedKeycloakUsers(users: SeedUser[]): Promise<void> {
  for (const { password, realmRoles, ...rep } of users) {
    const existing = await findUserByUsername(rep.username)
    let userId: string
    if (existing?.id) {
      await updateKeycloakUser(existing.id, rep)
      userId = existing.id
      console.log(`Updated user ${rep.username} (${userId})`)
    } else {
      userId = await createKeycloakUser({
        ...rep,
        enabled: true,
        emailVerified: true,
      })
      console.log(`Created user ${rep.username} (${userId})`)
    }

    await setUserPassword(userId, password, false)

    if (realmRoles?.length) {
      const current = new Set(
        (await getUserRealmRoles(userId)).map((r) => r.name)
      )
      for (const role of realmRoles) {
        if (!current.has(role)) {
          await assignRealmRole(userId, role)
          console.log(`  + realm role "${role}"`)
        }
      }
    }
  }

  console.log("Done.")
}
