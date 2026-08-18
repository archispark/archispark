import { describe, it, expect } from "vitest"
import { randomUUID } from "crypto"
import { getOrCreatePersonalOrganization } from "@workspace/db"
import * as registry from "./registry"
import { ForbiddenError } from "./errors"
import type { AccessUser } from "./access"

// Each test uses a fresh, unique user id — no local "users" table row is
// needed (identities live in Keycloak), only `organization_members`.
function newUser(): AccessUser {
  return { id: `registry-test-${randomUUID()}`, role: "user" }
}

describe("registry – createWorkspace / organization membership", () => {
  it("refuses to create a workspace for a user with no organization membership", async () => {
    const user = newUser()
    await expect(
      registry.createWorkspace(user, "No Org Workspace")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("does not auto-create a personal organization for that user", async () => {
    const user = newUser()
    await expect(
      registry.createWorkspace(user, "No Org Workspace")
    ).rejects.toThrow()

    // Still no organization and no workspace after the failed attempt.
    expect(await registry.getWorkspaces(user)).toEqual([])
  })

  it("creates a workspace in the caller's existing organization", async () => {
    const user = newUser()
    const organizationId = await getOrCreatePersonalOrganization(user.id)

    const ws = await registry.createWorkspace(user, "My Workspace")

    expect(ws.organization_id).toBe(String(organizationId))
    expect(ws.active).toBe(true)
  })
})
