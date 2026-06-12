import { signTenantToken } from "@workspace/db";
import type { WorkspaceContext } from "./tenant-auth.js";

// Shared with tenant-auth.test.ts. Set here (module scope, evaluated before any
// beforeAll) so requireTenantToken can verify tokens minted by getAdminToken().
process.env["TENANT_JWT_SECRET"] ??= "test-tenant-jwt-secret";

export const TEST_ORGANIZATION_ID = "test-org";
export const TEST_USER_ID = "test-user";

/** workspaces.organization_id has no FK — any string id is a valid fixture. */
export const TEST_CTX: WorkspaceContext = {
  organizationId: TEST_ORGANIZATION_ID,
  orgRole: "owner",
  teamIds: [],
};

/** Mints a tenant-api access token for the fixed test org/user (owner, no dedicated tenant DB). */
export function getAdminToken(): string {
  return signTenantToken({
    sub: TEST_USER_ID,
    username: "admin",
    platform_role: "user",
    organization_id: TEST_CTX.organizationId,
    org_role: TEST_CTX.orgRole,
    team_ids: TEST_CTX.teamIds,
    tenant_db: null,
  });
}
