/**
 * Drizzle ORM schema (ArchiMate 3.1, normalized PostgreSQL).
 *
 * Single shared database — no multi-tenancy. User identities live in
 * Keycloak (Phasetwo); see `@workspace/auth`. Every workspace is owned by
 * exactly one user (`ownerId`, a Keycloak `sub`); there is no organization
 * or team concept.
 *
 * Design:
 *   - Every entity table has a workspace_id FK → workspaces.id.
 *   - UUIDs kept as TEXT to match the Open Exchange xs:ID format ("id-" prefix).
 *   - Colors stored as RGBA integers (0-255 / 0-100 alpha), NULL when not set.
 *   - Properties keyed by property_def_uuid (TEXT), split into element_properties
 *     and relationship_properties to avoid polymorphic FK.
 *   - Node nesting via parent_node_uuid (self-reference by UUID, not FK int).
 *   - Bendpoints for connection routing stored in a child table.
 */

import {
  pgTable, text, integer, serial, boolean, real,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// API tokens (Bearer tokens for REST API access — one per user, named)
// ---------------------------------------------------------------------------

export const apiTokens = pgTable("api_tokens", {
  id:          serial("id").primaryKey(),
  token:       text("token").notNull(),
  name:        text("name").notNull(),
  // Keycloak `sub` of the token's owner (no FK: identities live in Keycloak).
  userId:      text("user_id").notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  createdAt:   integer("created_at").notNull().default(sql`extract(epoch from now())::int`),
  lastUsedAt:  integer("last_used_at"),
  expiresAt:   integer("expires_at"),
}, (t) => [
  uniqueIndex("api_tokens_token_uniq").on(t.token),
  index("api_tokens_user_idx").on(t.userId),
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
// Workspaces (replaces workspaces.json) — owned by a single user
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id:          serial("id").primaryKey(),
  uuid:        text("uuid").notNull(),          // ArchiMate model identifier (xs:ID)
  name:        text("name").notNull(),           // workspace / model display name
  description: text("description"),
  version:     text("version"),
  // Keycloak `sub` of the owning user (no FK: identities live in Keycloak).
  ownerId:     text("owner_id").notNull(),
  createdAt:   integer("created_at").notNull().default(sql`extract(epoch from now())::int`),
  updatedAt:   integer("updated_at").notNull().default(sql`extract(epoch from now())::int`),
}, (t) => [
  uniqueIndex("workspaces_owner_name_uniq").on(t.ownerId, t.name),
  index("workspaces_owner_idx").on(t.ownerId),
]);

// ---------------------------------------------------------------------------
// Per-user "active workspace" (replaces the old global workspaces.is_active flag)
// ---------------------------------------------------------------------------

export const userActiveWorkspace = pgTable("user_active_workspace", {
  userId:      text("user_id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
});

// ---------------------------------------------------------------------------
// Elements  (ArchiMate 3.1 — all layers)
// ---------------------------------------------------------------------------

export const elements = pgTable("elements", {
  id:          serial("id").primaryKey(),
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

export const relationships = pgTable("relationships", {
  id:                serial("id").primaryKey(),
  workspaceId:       integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uuid:              text("uuid").notNull(),
  type:              text("type").notNull(),      // Composition, Aggregation, Assignment, …
  name:              text("name"),
  description:       text("description"),
  sourceUuid:        text("source_uuid").notNull(),
  targetUuid:        text("target_uuid").notNull(),
  accessType:        text("access_type"),         // Access: Read, Write, ReadWrite, Access
  isDirected:        boolean("is_directed"),       // Association
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

export const propertyDefinitions = pgTable("property_definitions", {
  id:          serial("id").primaryKey(),
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

export const elementProperties = pgTable("element_properties", {
  id:              serial("id").primaryKey(),
  elementId:       integer("element_id").notNull().references(() => elements.id, { onDelete: "cascade" }),
  propertyDefUuid: text("property_def_uuid").notNull(),
  value:           text("value").notNull().default(""),
}, (t) => [
  index("elem_props_element_idx").on(t.elementId),
  index("elem_props_def_idx").on(t.propertyDefUuid),
]);

export const relationshipProperties = pgTable("relationship_properties", {
  id:              serial("id").primaryKey(),
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

export const views = pgTable("views", {
  id:          serial("id").primaryKey(),
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

export const nodes = pgTable("nodes", {
  id:             serial("id").primaryKey(),
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

export const connections = pgTable("connections", {
  id:               serial("id").primaryKey(),
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

export const bendpoints = pgTable("bendpoints", {
  id:           serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
  x:            integer("x").notNull(),
  y:            integer("y").notNull(),
  sortOrder:    integer("sort_order").notNull().default(0),
}, (t) => [
  index("bendpoints_connection_idx").on(t.connectionId),
]);
