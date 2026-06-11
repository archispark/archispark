/**
 * Drizzle ORM schema — tenant tables (ArchiMate 3.1, normalized PostgreSQL).
 *
 * Holds one organization's ArchiMate content: workspaces and everything
 * inside them (elements, relationships, views, nodes, connections,
 * bendpoints, property definitions/values).
 *
 * Design:
 *   - One dedicated database per tenant organization (see schema.control.ts
 *     `tenantDatabases`); until provisioned, all organizations share the
 *     control-plane physical database.
 *   - Every entity table has a workspace_id FK → workspaces.id.
 *   - UUIDs kept as TEXT to match the Open Exchange xs:ID format ("id-" prefix).
 *   - Colors stored as RGBA integers (0-255 / 0-100 alpha), NULL when not set.
 *   - Properties keyed by property_def_uuid (TEXT), split into element_properties
 *     and relationship_properties to avoid polymorphic FK.
 *   - Node nesting via parent_node_uuid (self-reference by UUID, not FK int).
 *   - Bendpoints for connection routing stored in a child table.
 *
 * `organizations`, `teams` and `users` are control-plane tables — a different
 * physical database once a tenant database is provisioned (Phase 3). The
 * organization_id / team_id / user_id columns below are therefore plain,
 * unconstrained TEXT columns (no `.references()`): a real FK would only work
 * while both schemas share one physical database, and cross-database FKs are
 * impossible once a tenant gets its own database. Referential integrity for
 * these columns is enforced at the application layer.
 */

import {
  pgTable, text, integer, serial, boolean, real,
  index, uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Workspaces (replaces workspaces.json)
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id:             serial("id").primaryKey(),
  uuid:           text("uuid").notNull(),          // ArchiMate model identifier (xs:ID)
  name:           text("name").notNull(),           // workspace / model display name
  description:    text("description"),
  version:        text("version"),
  organizationId: text("organization_id").notNull(),
  createdAt:      integer("created_at").notNull().default(sql`extract(epoch from now())::int`),
  updatedAt:      integer("updated_at").notNull().default(sql`extract(epoch from now())::int`),
}, (t) => [
  uniqueIndex("workspaces_org_name_uniq").on(t.organizationId, t.name),
  index("workspaces_organization_idx").on(t.organizationId),
]);

// ---------------------------------------------------------------------------
// Workspace ↔ team visibility restriction (optional — no rows means the
// workspace is visible to all members of the organization)
// ---------------------------------------------------------------------------

export const workspaceTeams = pgTable("workspace_teams", {
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  teamId:      text("team_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.teamId] }),
  index("workspace_teams_team_idx").on(t.teamId),
]);

// ---------------------------------------------------------------------------
// Per-user "active workspace" within an organization (replaces the old
// global workspaces.is_active flag)
// ---------------------------------------------------------------------------

export const userActiveWorkspace = pgTable("user_active_workspace", {
  userId:         text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  workspaceId:    integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.organizationId] }),
]);

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
