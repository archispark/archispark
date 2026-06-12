/**
 * Inter-service auth contract between `apps/control-api` and `apps/tenant-api`
 * (Phase 5).
 *
 * control-api signs a short-lived token carrying the identity + workspace it
 * already resolved (session/API-token auth, `resolveWorkspaceContext`,
 * `requireWorkspaceWrite`) and the encrypted tenant connection string (if the
 * organization has an active dedicated database). tenant-api verifies the
 * token, reconstructs `req.user`/`req.workspace` from its claims, and decrypts
 * `tenant_db` itself with `TENANT_DB_ENCRYPTION_KEY` — control-api never holds
 * that key. Both sides share `TENANT_JWT_SECRET`.
 */

import jwt, { type SignOptions } from "jsonwebtoken";

export interface TenantTokenPayload {
  sub: string;
  username: string;
  platform_role: string;
  organization_id: string;
  org_role: string;
  team_ids: string[];
  tenant_db: string | null;
}

function secret(): string {
  const value = process.env["TENANT_JWT_SECRET"];
  if (!value) throw new Error("TENANT_JWT_SECRET is required to sign/verify inter-service tokens");
  return value;
}

/** Signs a tenant-api access token. Default expiry is 60 seconds. */
export function signTenantToken(payload: TenantTokenPayload, expiresIn: SignOptions["expiresIn"] = "60s"): string {
  return jwt.sign(payload, secret(), { expiresIn });
}

/** Verifies and decodes a tenant-api access token. Throws if invalid/expired. */
export function verifyTenantToken(token: string): TenantTokenPayload {
  return jwt.verify(token, secret()) as TenantTokenPayload;
}
