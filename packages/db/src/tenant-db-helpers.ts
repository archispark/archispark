/**
 * Small helpers shared by the Neon (`tenant-provisioning.ts`) and local
 * (`local-provisioning.ts`) tenant database provisioning paths. Split out to
 * avoid a circular import between those two modules.
 */

import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { controlDb } from "./connection.js";

/** Postgres identifiers must be lowercase alphanumeric/underscore. */
export function sanitizeIdentifier(organizationId: string): string {
  return organizationId.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

/** Marks `organizationId`'s `tenant_databases` row `"error"` with `err`'s message. */
export async function markTenantDatabaseError(organizationId: string, err?: unknown): Promise<void> {
  const lastError = err instanceof Error ? err.message : (err ? String(err) : null);
  await controlDb.update(schema.tenantDatabases).set({ status: "error", lastError, updatedAt: new Date() })
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
}
