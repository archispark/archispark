/**
 * Aggregated Drizzle ORM schema.
 *
 * The schema is split into two physical-database concerns:
 *   - schema.control.ts — platform identity & tenancy metadata (Better Auth
 *     tables, organizations/teams/members, API tokens, tenant registry).
 *   - schema.tenant.ts  — one organization's ArchiMate content (workspaces,
 *     elements, relationships, views, …).
 *
 * Until tenant databases are provisioned (Phase 3), both sets of tables live
 * in the same physical database and are queried through a single Drizzle
 * client built from this aggregated schema (see connection.ts).
 */

export * from "./schema.control.js";
export * from "./schema.tenant.js";
