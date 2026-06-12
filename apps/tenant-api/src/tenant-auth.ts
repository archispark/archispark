/**
 * Inter-service auth middleware for `apps/tenant-api`.
 *
 * Verifies the JWT minted by `apps/control-api` (see `@workspace/db`'s
 * `tenant-jwt.ts`) and reconstructs `req.user`/`req.workspace`/
 * `req.tenantDbEncrypted` from its claims. control-api already ran
 * `requireAuth`, `resolveWorkspaceContext` and `requireWorkspaceWrite` before
 * proxying — this middleware trusts any token signed with the shared
 * `TENANT_JWT_SECRET`, no re-check needed.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyTenantToken } from "@workspace/db";
import { UnauthorizedError } from "./errors.js";

export interface WorkspaceContext {
  organizationId: string;
  orgRole: string;
  teamIds: string[];
}

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
  workspace?: WorkspaceContext;
  tenantDbEncrypted?: string | null;
}

export function requireTenantToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) { next(new UnauthorizedError("Token manquant.")); return; }
  try {
    const payload = verifyTenantToken(header.slice(7));
    req.user = { id: payload.sub, username: payload.username, role: payload.platform_role };
    req.workspace = { organizationId: payload.organization_id, orgRole: payload.org_role, teamIds: payload.team_ids };
    req.tenantDbEncrypted = payload.tenant_db;
    next();
  } catch {
    next(new UnauthorizedError("Token invalide ou expiré."));
  }
}
