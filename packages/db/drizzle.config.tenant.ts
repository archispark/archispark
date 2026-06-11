import { defineConfig } from "drizzle-kit";

// Tenant-only schema (schema.tenant.ts): the migrations generated here are
// the ones played against a freshly provisioned per-tenant database (Phase 3
// — see provisionTenantDatabase in src/tenant-provisioning.ts). They contain
// no references to control-plane tables (organization/team/user) since those
// live in a different physical database once a tenant is provisioned.
//
// `drizzle-kit generate` only diffs the TS schema against the snapshots in
// drizzle-pg/tenant/meta/ — it never connects to a database, so a dummy URL
// is fine here (a real DATABASE_URL is not required to regenerate this folder).
export default defineConfig({
  schema: "./src/schema.tenant.ts",
  out: "./drizzle-pg/tenant",
  dialect: "postgresql",
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/placeholder" },
});
