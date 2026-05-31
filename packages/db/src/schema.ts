/**
 * Drizzle ORM schema for ArchiMate 3.1 — normalized SQLite tables.
 *
 * Design:
 *   - One database file (archispark.db) for all workspaces.
 *   - Every entity table has a workspace_id FK → workspaces.id.
 *   - UUIDs kept as TEXT to match the Open Exchange xs:ID format ("id-" prefix).
 *   - Colors stored as RGBA integers (0-255 / 0-100 alpha), NULL when not set.
 *   - Properties keyed by property_def_uuid (TEXT), split into element_properties
 *     and relationship_properties to avoid polymorphic FK.
 *   - Node nesting via parent_node_uuid (self-reference by UUID, not FK int).
 *   - Bendpoints for connection routing stored in a child table.
 */

import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Workspaces (replaces workspaces.json)
// ---------------------------------------------------------------------------

export const workspaces = sqliteTable("workspaces", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  uuid:        text("uuid").notNull(),          // ArchiMate model identifier (xs:ID)
  name:        text("name").notNull(),           // workspace / model display name
  description: text("description"),
  version:     text("version"),
  createdAt:   integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt:   integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("workspaces_name_uniq").on(t.name),
]);

// ---------------------------------------------------------------------------
// Elements  (ArchiMate 3.1 — all layers)
// ---------------------------------------------------------------------------

export const elements = sqliteTable("elements", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:        text("uuid").notNull(),
  type:        text("type").notNull(),           // ArchiMate element type (ApplicationComponent, etc.)
  name:        text("name").notNull().default(""),
  description: text("description"),
}, (t) => [
  uniqueIndex("elements_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("elements_workspace_idx").on(t.workspaceId),
  index("elements_type_idx").on(t.workspaceId, t.type),
]);

// ---------------------------------------------------------------------------
// Relationships  (ArchiMate 3.1 — 11 structural + junction types)
// ---------------------------------------------------------------------------

export const relationships = sqliteTable("relationships", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  workspaceId:       integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:              text("uuid").notNull(),
  type:              text("type").notNull(),      // Composition, Aggregation, Assignment, …
  name:              text("name"),
  description:       text("description"),
  sourceUuid:        text("source_uuid").notNull(),
  targetUuid:        text("target_uuid").notNull(),
  accessType:        text("access_type"),         // Access: Read, Write, ReadWrite, Access
  isDirected:        integer("is_directed", { mode: "boolean" }),  // Association
  influenceModifier: text("influence_modifier"),  // Influence: +, ++, -, …
}, (t) => [
  uniqueIndex("relationships_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("relationships_workspace_idx").on(t.workspaceId),
  index("relationships_source_idx").on(t.workspaceId, t.sourceUuid),
  index("relationships_target_idx").on(t.workspaceId, t.targetUuid),
]);

// ---------------------------------------------------------------------------
// Property definitions  (schema for custom metadata)
// ---------------------------------------------------------------------------

export const propertyDefinitions = sqliteTable("property_definitions", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:        text("uuid").notNull(),
  name:        text("name").notNull(),
  type:        text("type").notNull().default("string"),  // string | boolean | date | number | enumeration
}, (t) => [
  uniqueIndex("prop_defs_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("prop_defs_workspace_idx").on(t.workspaceId),
]);

// ---------------------------------------------------------------------------
// Properties (key-value metadata on elements and relationships, split tables)
// ---------------------------------------------------------------------------

export const elementProperties = sqliteTable("element_properties", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  elementId:       integer("element_id").notNull().references(() => elements.id, { onDelete: "cascade" }),
  propertyDefUuid: text("property_def_uuid").notNull(),
  value:           text("value").notNull().default(""),
}, (t) => [
  index("elem_props_element_idx").on(t.elementId),
  index("elem_props_def_idx").on(t.propertyDefUuid),
]);

export const relationshipProperties = sqliteTable("relationship_properties", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  relationshipId:  integer("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
  propertyDefUuid: text("property_def_uuid").notNull(),
  value:           text("value").notNull().default(""),
}, (t) => [
  index("rel_props_relationship_idx").on(t.relationshipId),
  index("rel_props_def_idx").on(t.propertyDefUuid),
]);

// ---------------------------------------------------------------------------
// Views  (ArchiMate diagrams)
// ---------------------------------------------------------------------------

export const views = sqliteTable("views", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:        text("uuid").notNull(),
  name:        text("name").notNull().default(""),
  description: text("description"),
  viewpoint:   text("viewpoint"),                // standard viewpoint name or custom string
}, (t) => [
  uniqueIndex("views_uuid_ws_uniq").on(t.workspaceId, t.uuid),
  index("views_workspace_idx").on(t.workspaceId),
]);

// ---------------------------------------------------------------------------
// Nodes  (visual shapes in a view)
// ---------------------------------------------------------------------------

export const nodes = sqliteTable("nodes", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  viewId:         integer("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
  uuid:           text("uuid").notNull(),
  name:           text("name"),
  elementUuid:    text("element_uuid"),           // ref → elements.uuid (NULL for containers/labels)
  parentNodeUuid: text("parent_node_uuid"),        // NULL = root node in view
  x:              integer("x"),
  y:              integer("y"),
  w:              integer("w"),
  h:              integer("h"),
  // Style — fill color
  fillColorR:     integer("fill_color_r"),
  fillColorG:     integer("fill_color_g"),
  fillColorB:     integer("fill_color_b"),
  fillColorA:     integer("fill_color_a"),
  // Style — line
  lineColorR:     integer("line_color_r"),
  lineColorG:     integer("line_color_g"),
  lineColorB:     integer("line_color_b"),
  lineColorA:     integer("line_color_a"),
  lineWidth:      integer("line_width"),
  // Style — font
  fontName:       text("font_name"),
  fontSize:       real("font_size"),
  fontColorR:     integer("font_color_r"),
  fontColorG:     integer("font_color_g"),
  fontColorB:     integer("font_color_b"),
  fontColorA:     integer("font_color_a"),
  sortOrder:      integer("sort_order").notNull().default(0),
}, (t) => [
  uniqueIndex("nodes_uuid_view_uniq").on(t.viewId, t.uuid),
  index("nodes_view_idx").on(t.viewId),
  index("nodes_parent_idx").on(t.viewId, t.parentNodeUuid),
  index("nodes_element_idx").on(t.elementUuid),
]);

// ---------------------------------------------------------------------------
// Connections  (visual connectors in a view)
// ---------------------------------------------------------------------------

export const connections = sqliteTable("connections", {
  id:               integer("id").primaryKey({ autoIncrement: true }),
  viewId:           integer("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
  uuid:             text("uuid").notNull(),
  name:             text("name"),
  relationshipUuid: text("relationship_uuid"),     // ref → relationships.uuid
  sourceNodeUuid:   text("source_node_uuid"),
  targetNodeUuid:   text("target_node_uuid"),
  // Style — line
  lineColorR:       integer("line_color_r"),
  lineColorG:       integer("line_color_g"),
  lineColorB:       integer("line_color_b"),
  lineColorA:       integer("line_color_a"),
  lineWidth:        integer("line_width"),
  // Style — font
  fontName:         text("font_name"),
  fontSize:         real("font_size"),
  fontColorR:       integer("font_color_r"),
  fontColorG:       integer("font_color_g"),
  fontColorB:       integer("font_color_b"),
  fontColorA:       integer("font_color_a"),
}, (t) => [
  uniqueIndex("connections_uuid_view_uniq").on(t.viewId, t.uuid),
  index("connections_view_idx").on(t.viewId),
  index("connections_rel_idx").on(t.relationshipUuid),
]);

// ---------------------------------------------------------------------------
// Bendpoints  (waypoints for connection routing)
// ---------------------------------------------------------------------------

export const bendpoints = sqliteTable("bendpoints", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  connectionId: integer("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
  x:            integer("x").notNull(),
  y:            integer("y").notNull(),
  sortOrder:    integer("sort_order").notNull().default(0),
}, (t) => [
  index("bendpoints_connection_idx").on(t.connectionId),
]);

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const users = sqliteTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image:         text("image"),
  createdAt:     integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt:     integer("updated_at", { mode: "timestamp" }).notNull(),
  username:        text("username").notNull(),
  displayUsername: text("display_username"),
  role:            text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  banned:          integer("banned", { mode: "boolean" }),
  banReason:       text("ban_reason"),
  banExpires:      integer("ban_expires"),
}, (t) => [
  uniqueIndex("user_username_uniq").on(t.username),
]);

export const sessions = sqliteTable("session", {
  id:           text("id").primaryKey(),
  userId:       text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:        text("token").notNull(),
  expiresAt:    integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress:    text("ip_address"),
  userAgent:    text("user_agent"),
  createdAt:    integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt:    integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  uniqueIndex("session_token_uniq").on(t.token),
]);

export const accounts = sqliteTable("account", {
  id:                  text("id").primaryKey(),
  userId:              text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId:           text("account_id").notNull(),
  providerId:          text("provider_id").notNull(),
  accessToken:         text("access_token"),
  refreshToken:        text("refresh_token"),
  idToken:             text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope:               text("scope"),
  password:            text("password"),
  createdAt:           integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt:           integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt:  integer("created_at", { mode: "timestamp" }),
  updatedAt:  integer("updated_at", { mode: "timestamp" }),
});

export const roles = sqliteTable("roles", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  isSystem:    integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt:   integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("roles_name_uniq").on(t.name),
]);

// permission stored as bit flags: read=1, create=2, update=4, delete=8
export const roleLayerPermissions = sqliteTable("role_layer_permissions", {
  roleId:     text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  layer:      text("layer").notNull(),
  permission: integer("permission").notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.roleId, t.layer] }),
]);

export const userRoles = sqliteTable("user_roles", {
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.roleId, t.userId] }),
]);

// ---------------------------------------------------------------------------
// OAuth / OIDC provider configurations (managed via admin UI)
// ---------------------------------------------------------------------------

export const oauthProviders = sqliteTable("oauth_providers", {
  id:          text("id").primaryKey(),
  providerId:  text("provider_id").notNull(),         // slug used in OAuth flow
  type:        text("type", { enum: ["oidc", "google", "github", "microsoft-entra-id"] }).notNull(),
  name:        text("name").notNull(),                // display name
  clientId:    text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  issuerUrl:   text("issuer_url"),                   // OIDC only
  tenantId:    text("tenant_id"),                    // Microsoft Entra only
  enabled:     integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt:   integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("oauth_providers_provider_id_uniq").on(t.providerId),
]);
