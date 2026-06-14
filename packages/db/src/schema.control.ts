/**
 * Drizzle ORM schema — control-plane tables.
 *
 * Holds platform-wide identity & tenancy metadata: Better Auth tables (users,
 * sessions, accounts, verifications), teams, platform settings (OAuth
 * providers, site messages), API tokens, and the tenant database registry.
 *
 * Organizations, their members/roles and invitations live in Keycloak
 * (Phasetwo Organizations extension, see `@workspace/auth`'s `orgs.ts`) —
 * `organizationSettings` only stores the platform-admin "enabled" flag per
 * organization id.
 *
 * This lives in a single shared "control-plane" Postgres database. Each
 * tenant's ArchiMate content (workspaces, elements, relationships, views, …)
 * lives in its own dedicated database, described by schema.tenant.ts and
 * registered here via `tenantDatabases`.
 */

import {
  pgTable, text, integer, serial, boolean,
  timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Organizations (Keycloak/Phasetwo) — platform-admin "enabled" flag only
// ---------------------------------------------------------------------------

export const organizationSettings = pgTable("organization_settings", {
  organizationId: text("organization_id").primaryKey(),
  // Platform admins can suspend an organization (blocks non-platform_admin
  // members in resolveWorkspaceContext) without deleting its data. Absence of
  // a row means "enabled" (default true).
  enabled:        boolean("enabled").notNull().default(true),
  // Phasetwo organizations have no creation timestamp of their own — recorded
  // here (lazily backfilled for orgs that already existed in Keycloak) so the
  // admin organizations list can be sorted/displayed by creation date.
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Teams — local to control-db, scoped to a Keycloak/Phasetwo organization id
// (no FK: organizations live in Keycloak, not in this database).
// ---------------------------------------------------------------------------

export const teams = pgTable("team", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  organizationId: text("organization_id").notNull(),
  createdAt:      timestamp("created_at").notNull(),
  updatedAt:      timestamp("updated_at"),
}, (t) => [
  index("team_organization_idx").on(t.organizationId),
]);

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image:         text("image"),
  createdAt:     timestamp("created_at").notNull(),
  updatedAt:     timestamp("updated_at").notNull(),
  username:        text("username").notNull(),
  displayUsername: text("display_username"),
  // Platform-wide role: "user" | "platform_admin". Distinct from the
  // per-organization `members.role` ("owner" | "admin" | "member").
  role:            text("role").notNull().default("user"),
  banned:          boolean("banned"),
  banReason:       text("ban_reason"),
  banExpires:      integer("ban_expires"),
  // Bridges Keycloak `sub` claims to this row during the Better Auth ->
  // Keycloak migration (Stage 2). NULL for users not yet provisioned in
  // Keycloak.
  keycloakSub:     text("keycloak_sub"),
}, (t) => [
  uniqueIndex("user_username_uniq").on(t.username),
  uniqueIndex("user_keycloak_sub_uniq").on(t.keycloakSub),
]);

export const sessions = pgTable("session", {
  id:                   text("id").primaryKey(),
  userId:               text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:                text("token").notNull(),
  expiresAt:            timestamp("expires_at").notNull(),
  ipAddress:            text("ip_address"),
  userAgent:            text("user_agent"),
  activeOrganizationId: text("active_organization_id"),
  activeTeamId:         text("active_team_id"),
  createdAt:            timestamp("created_at").notNull(),
  updatedAt:            timestamp("updated_at").notNull(),
}, (t) => [
  uniqueIndex("session_token_uniq").on(t.token),
]);

export const accounts = pgTable("account", {
  id:                  text("id").primaryKey(),
  userId:              text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId:           text("account_id").notNull(),
  providerId:          text("provider_id").notNull(),
  accessToken:         text("access_token"),
  refreshToken:        text("refresh_token"),
  idToken:             text("id_token"),
  accessTokenExpiresAt:  timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope:               text("scope"),
  password:            text("password"),
  createdAt:           timestamp("created_at").notNull(),
  updatedAt:           timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at"),
  updatedAt:  timestamp("updated_at"),
});

// ---------------------------------------------------------------------------
// Team membership — userId is a Keycloak `sub` (no FK: identities live in
// Keycloak, not in the `user` table, once Phase 5 provisioning lands).
// ---------------------------------------------------------------------------

export const teamMembers = pgTable("team_member", {
  id:        text("id").primaryKey(),
  teamId:    text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull(),
  createdAt: timestamp("created_at"),
}, (t) => [
  index("team_member_team_idx").on(t.teamId),
  index("team_member_user_idx").on(t.userId),
]);

// ---------------------------------------------------------------------------
// API tokens (Bearer tokens for REST API access — one per user, named)
// ---------------------------------------------------------------------------

export const apiTokens = pgTable("api_tokens", {
  id:             serial("id").primaryKey(),
  token:          text("token").notNull(),
  name:           text("name").notNull(),
  // Keycloak `sub` of the token's owner (no FK).
  userId:         text("user_id").notNull(),
  // Keycloak/Phasetwo organization id (no FK).
  organizationId: text("organization_id").notNull(),
  // References `workspaces.id` in the tenant database for that organization.
  // Not a real FK: workspaces live in a separate physical database, so
  // referential integrity is enforced at the application layer instead.
  workspaceId:    integer("workspace_id"),
  createdAt:      integer("created_at").notNull().default(sql`extract(epoch from now())::int`),
  lastUsedAt:     integer("last_used_at"),
  expiresAt:      integer("expires_at"),
}, (t) => [
  uniqueIndex("api_tokens_token_uniq").on(t.token),
  index("api_tokens_user_idx").on(t.userId),
  index("api_tokens_organization_idx").on(t.organizationId),
]);

// ---------------------------------------------------------------------------
// OAuth / OIDC provider configurations (managed via admin UI)
// ---------------------------------------------------------------------------

export const oauthProviders = pgTable("oauth_providers", {
  id:          text("id").primaryKey(),
  providerId:  text("provider_id").notNull(),         // slug used in OAuth flow
  type:        text("type", { enum: ["oidc", "google", "github", "microsoft-entra-id"] }).notNull(),
  name:        text("name").notNull(),                // display name
  clientId:    text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  issuerUrl:   text("issuer_url"),                   // OIDC only
  tenantId:    text("tenant_id"),                    // Microsoft Entra only
  enabled:     boolean("enabled").notNull().default(true),
  createdAt:   integer("created_at").notNull().default(sql`extract(epoch from now())::int`),
}, (t) => [
  uniqueIndex("oauth_providers_provider_id_uniq").on(t.providerId),
]);

// ---------------------------------------------------------------------------
// Site settings — singleton row (id = 1) for login/banner messages
// ---------------------------------------------------------------------------

export const siteSettings = pgTable("site_settings", {
  id:                   integer("id").primaryKey(),
  loginMessage:         text("login_message"),
  loginMessageEnabled:  boolean("login_message_enabled").notNull().default(false),
  bannerMessage:        text("banner_message"),
  bannerMessageEnabled: boolean("banner_message_enabled").notNull().default(false),
  updatedAt:            integer("updated_at").notNull().default(sql`extract(epoch from now())::int`),
});

// ---------------------------------------------------------------------------
// Tenant database registry — maps each Keycloak/Phasetwo organization id to
// its dedicated ArchiMate-content database (schema.tenant.ts). Until
// provisioned (Phase 3), an organization has no row here and its content
// lives alongside the control-plane tables in the same physical database.
// ---------------------------------------------------------------------------

export const tenantDatabases = pgTable("tenant_databases", {
  organizationId:    text("organization_id").primaryKey(),
  neonProjectId:     text("neon_project_id"),
  neonDatabaseName:  text("neon_database_name").notNull(),
  neonRoleName:      text("neon_role_name").notNull(),
  // Encrypted at rest (application-level encryption — see Phase 3).
  connectionStringEncrypted: text("connection_string_encrypted").notNull(),
  status:            text("status", { enum: ["pending", "provisioning", "active", "error"] }).notNull().default("pending"),
  region:            text("region"),
  verifiedAt:        timestamp("verified_at"),
  lastError:         text("last_error"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  updatedAt:         timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("tenant_databases_status_idx").on(t.status),
]);
