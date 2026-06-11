/**
 * Drizzle ORM schema — control-plane tables.
 *
 * Holds platform-wide identity & tenancy metadata: Better Auth tables (users,
 * sessions, organizations, members, teams, invitations), platform settings
 * (OAuth providers, site messages), API tokens, and the tenant database
 * registry.
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
// Organizations & teams (Better Auth organization plugin)
// ---------------------------------------------------------------------------

export const organizations = pgTable("organization", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  slug:      text("slug").notNull(),
  logo:      text("logo"),
  metadata:  text("metadata"),
  createdAt: timestamp("created_at").notNull(),
}, (t) => [
  uniqueIndex("organization_slug_uniq").on(t.slug),
]);

export const teams = pgTable("team", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
}, (t) => [
  uniqueIndex("user_username_uniq").on(t.username),
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
// Organization membership, teams & invitations (Better Auth organization plugin)
// ---------------------------------------------------------------------------

export const members = pgTable("member", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId:         text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:           text("role").notNull().default("member"),
  createdAt:      timestamp("created_at").notNull(),
}, (t) => [
  index("member_organization_idx").on(t.organizationId),
  index("member_user_idx").on(t.userId),
  uniqueIndex("member_org_user_uniq").on(t.organizationId, t.userId),
]);

export const teamMembers = pgTable("team_member", {
  id:        text("id").primaryKey(),
  teamId:    text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at"),
}, (t) => [
  index("team_member_team_idx").on(t.teamId),
  index("team_member_user_idx").on(t.userId),
]);

export const invitations = pgTable("invitation", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email:          text("email").notNull(),
  role:           text("role"),
  teamId:         text("team_id"),
  status:         text("status").notNull().default("pending"),
  expiresAt:      timestamp("expires_at").notNull(),
  createdAt:      timestamp("created_at").notNull(),
  inviterId:      text("inviter_id").notNull().references(() => users.id),
}, (t) => [
  index("invitation_organization_idx").on(t.organizationId),
  index("invitation_email_idx").on(t.email),
]);

// ---------------------------------------------------------------------------
// API tokens (Bearer tokens for REST API access — one per user, named)
// ---------------------------------------------------------------------------

export const apiTokens = pgTable("api_tokens", {
  id:             serial("id").primaryKey(),
  token:          text("token").notNull(),
  name:           text("name").notNull(),
  userId:         text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
// Tenant database registry — maps each organization to its dedicated
// ArchiMate-content database (schema.tenant.ts). Until provisioned (Phase 3),
// an organization has no row here and its content lives alongside the
// control-plane tables in the same physical database.
// ---------------------------------------------------------------------------

export const tenantDatabases = pgTable("tenant_databases", {
  organizationId:    text("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
  neonProjectId:     text("neon_project_id"),
  neonDatabaseName:  text("neon_database_name").notNull(),
  neonRoleName:      text("neon_role_name").notNull(),
  // Encrypted at rest (application-level encryption — see Phase 3).
  connectionStringEncrypted: text("connection_string_encrypted").notNull(),
  status:            text("status", { enum: ["pending", "provisioning", "active", "error"] }).notNull().default("pending"),
  region:            text("region"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  updatedAt:         timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("tenant_databases_status_idx").on(t.status),
]);
