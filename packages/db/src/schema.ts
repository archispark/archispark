/**
 * Drizzle ORM schema (ArchiMate 3.1, normalized PostgreSQL).
 *
 * Single shared database, applicative multi-tenancy. Hierarchy:
 * organizations → workspaces → elements/relationships/views/... . User
 * identities live in Keycloak; see `@workspace/auth`. An Organization groups
 * Workspaces and members with one of four roles — `platform_admin`
 * (administers organizations, no access to their data, enforced structurally
 * in `apps/api/src/access.ts`), `owner`, `admin`, `member` (see
 * `organization_members.role`). Every user gets a personal organization
 * (`is_personal = true`) the first time they create a workspace; creating a
 * "team" organization is a separate explicit action.
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
  pgTable,
  text,
  integer,
  serial,
  boolean,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ---------------------------------------------------------------------------
// Organizations — group workspaces and members (SaaS multi-tenancy, Postgres-native)
// ---------------------------------------------------------------------------

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Auto-created on a user's first workspace (see Phase 4 invariant); false
    // for an explicitly created "team" organization.
    isPersonal: boolean("is_personal").notNull().default(false),
    // Keycloak `sub` of the personal organization's owner — the backfill's
    // idempotence key (ON CONFLICT DO NOTHING). NULL for team organizations.
    personalOwnerId: text("personal_owner_id"),
    // Suspension flag, set by a platform_admin — false blocks all access,
    // including for an `owner` of the organization.
    enabled: boolean("enabled").notNull().default(true),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [
    uniqueIndex("organizations_slug_uniq").on(t.slug),
    uniqueIndex("organizations_personal_owner_uniq").on(t.personalOwnerId),
  ]
)

// ---------------------------------------------------------------------------
// Organization members — role-based access (owner/admin/member)
// ---------------------------------------------------------------------------

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Keycloak `sub` of the member (no FK: identities live in Keycloak).
    userId: text("user_id").notNull(),
    role: text("role").notNull(), // "owner" | "admin" | "member"
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [
    uniqueIndex("org_members_org_user_uniq").on(t.organizationId, t.userId),
    index("org_members_org_idx").on(t.organizationId),
    index("org_members_user_idx").on(t.userId),
  ]
)

// ---------------------------------------------------------------------------
// Organization invitations — email + token, one active per (org, email)
// ---------------------------------------------------------------------------

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // lowercase
    role: text("role").notNull(), // "owner" | "admin" | "member"
    // sha256 of the invitation token — the clear-text token is never
    // persisted, only emailed; lookups hash the received token and compare.
    tokenHash: text("token_hash").notNull(),
    // Keycloak `sub` of the inviter (no FK: identities live in Keycloak).
    invitedByUserId: text("invited_by_user_id").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    expiresAt: integer("expires_at").notNull(),
    sentAt: integer("sent_at"), // NULL if the SMTP send failed
    acceptedAt: integer("accepted_at"),
    revokedAt: integer("revoked_at"),
  },
  (t) => [
    uniqueIndex("org_invitations_token_hash_uniq").on(t.tokenHash),
    // Only one active (not accepted, not revoked) invitation per (org, email)
    // — enforced by Postgres itself so two concurrent creates can't both
    // succeed past an application-level check.
    uniqueIndex("org_invitations_org_email_active_uniq")
      .on(t.organizationId, t.email)
      .where(sql`accepted_at IS NULL AND revoked_at IS NULL`),
    index("org_invitations_org_idx").on(t.organizationId),
  ]
)

// ---------------------------------------------------------------------------
// Per-user "active organization" — which organization the user is currently in
// ---------------------------------------------------------------------------

export const userActiveOrganization = pgTable("user_active_organization", {
  userId: text("user_id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
})

// ---------------------------------------------------------------------------
// API tokens (Bearer tokens for REST API access — one per user, named)
// ---------------------------------------------------------------------------

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    name: text("name").notNull(),
    // Keycloak `sub` of the token's owner (no FK: identities live in Keycloak).
    userId: text("user_id").notNull(),
    // Organization this token is scoped to (required at creation — see
    // apps/api/src/access.ts). Nullable at the DB level only during the
    // expand→backfill→contract migration window (packages/db/src/
    // backfill-organizations.ts); every row is guaranteed non-null once the
    // backfill has run. workspaceId optionally pins the token to one
    // workspace of that organization.
    organizationId: integer("organization_id").references(
      () => organizations.id,
      { onDelete: "cascade" }
    ),
    workspaceId: integer("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    lastUsedAt: integer("last_used_at"),
    expiresAt: integer("expires_at"),
  },
  (t) => [
    uniqueIndex("api_tokens_token_uniq").on(t.token),
    index("api_tokens_user_idx").on(t.userId),
    index("api_tokens_organization_idx").on(t.organizationId),
  ]
)

// ---------------------------------------------------------------------------
// Site settings — singleton row (id = 1) for login/banner messages
// ---------------------------------------------------------------------------

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  loginMessage: text("login_message"),
  loginMessageEnabled: boolean("login_message_enabled")
    .notNull()
    .default(false),
  bannerMessage: text("banner_message"),
  bannerMessageEnabled: boolean("banner_message_enabled")
    .notNull()
    .default(false),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`extract(epoch from now())::int`),
})

// ---------------------------------------------------------------------------
// Workspaces (replaces workspaces.json) — belong to exactly one organization
// ---------------------------------------------------------------------------

export const workspaces = pgTable(
  "workspaces",
  {
    id: serial("id").primaryKey(),
    uuid: text("uuid").notNull(), // ArchiMate model identifier (xs:ID)
    name: text("name").notNull(), // workspace / model display name
    description: text("description"),
    version: text("version"),
    // Organization this workspace belongs to. Nullable at the DB level only
    // during the expand→backfill→contract migration window — see apiTokens
    // comment above and packages/db/src/backfill-organizations.ts.
    organizationId: integer("organization_id").references(
      () => organizations.id,
      { onDelete: "cascade" }
    ),
    // Keycloak `sub` of the user who created the workspace — traceability
    // only, non-authoritative (never used for access control; see access.ts).
    createdById: text("created_by_id").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`extract(epoch from now())::int`),
  },
  (t) => [
    uniqueIndex("workspaces_org_name_uniq").on(t.organizationId, t.name),
    index("workspaces_org_idx").on(t.organizationId),
  ]
)

// ---------------------------------------------------------------------------
// Per-user "active workspace" per organization (replaces the old global
// workspaces.is_active flag) — a user can have a different active workspace
// in each organization they belong to.
// ---------------------------------------------------------------------------

export const userActiveWorkspace = pgTable(
  "user_active_workspace",
  {
    userId: text("user_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.organizationId] })]
)

// ---------------------------------------------------------------------------
// Elements  (ArchiMate 3.1 — all layers)
// ---------------------------------------------------------------------------

export const elements = pgTable(
  "elements",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uuid: text("uuid").notNull(),
    type: text("type").notNull(), // ArchiMate element type (ApplicationComponent, etc.)
    name: text("name").notNull().default(""),
    description: text("description"),
  },
  (t) => [
    uniqueIndex("elements_uuid_ws_uniq").on(t.workspaceId, t.uuid),
    index("elements_workspace_idx").on(t.workspaceId),
    index("elements_type_idx").on(t.workspaceId, t.type),
  ]
)

// ---------------------------------------------------------------------------
// Relationships  (ArchiMate 3.1 — 11 structural + junction types)
// ---------------------------------------------------------------------------

export const relationships = pgTable(
  "relationships",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uuid: text("uuid").notNull(),
    type: text("type").notNull(), // Composition, Aggregation, Assignment, …
    name: text("name"),
    description: text("description"),
    sourceUuid: text("source_uuid").notNull(),
    targetUuid: text("target_uuid").notNull(),
    accessType: text("access_type"), // Access: Read, Write, ReadWrite, Access
    isDirected: boolean("is_directed"), // Association
    influenceModifier: text("influence_modifier"), // Influence: +, ++, -, …
  },
  (t) => [
    uniqueIndex("relationships_uuid_ws_uniq").on(t.workspaceId, t.uuid),
    index("relationships_workspace_idx").on(t.workspaceId),
    index("relationships_source_idx").on(t.workspaceId, t.sourceUuid),
    index("relationships_target_idx").on(t.workspaceId, t.targetUuid),
  ]
)

// ---------------------------------------------------------------------------
// Property definitions  (schema for custom metadata)
// ---------------------------------------------------------------------------

export const propertyDefinitions = pgTable(
  "property_definitions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uuid: text("uuid").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull().default("string"), // string | boolean | date | number | enumeration
  },
  (t) => [
    uniqueIndex("prop_defs_uuid_ws_uniq").on(t.workspaceId, t.uuid),
    index("prop_defs_workspace_idx").on(t.workspaceId),
  ]
)

// ---------------------------------------------------------------------------
// Properties (key-value metadata on elements and relationships, split tables)
// ---------------------------------------------------------------------------

export const elementProperties = pgTable(
  "element_properties",
  {
    id: serial("id").primaryKey(),
    elementId: integer("element_id")
      .notNull()
      .references(() => elements.id, { onDelete: "cascade" }),
    propertyDefUuid: text("property_def_uuid").notNull(),
    value: text("value").notNull().default(""),
  },
  (t) => [
    index("elem_props_element_idx").on(t.elementId),
    index("elem_props_def_idx").on(t.propertyDefUuid),
  ]
)

export const relationshipProperties = pgTable(
  "relationship_properties",
  {
    id: serial("id").primaryKey(),
    relationshipId: integer("relationship_id")
      .notNull()
      .references(() => relationships.id, { onDelete: "cascade" }),
    propertyDefUuid: text("property_def_uuid").notNull(),
    value: text("value").notNull().default(""),
  },
  (t) => [
    index("rel_props_relationship_idx").on(t.relationshipId),
    index("rel_props_def_idx").on(t.propertyDefUuid),
  ]
)

// ---------------------------------------------------------------------------
// Views  (ArchiMate diagrams)
// ---------------------------------------------------------------------------

export const views = pgTable(
  "views",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uuid: text("uuid").notNull(),
    name: text("name").notNull().default(""),
    description: text("description"),
    viewpoint: text("viewpoint"), // standard viewpoint name or custom string
  },
  (t) => [
    uniqueIndex("views_uuid_ws_uniq").on(t.workspaceId, t.uuid),
    index("views_workspace_idx").on(t.workspaceId),
  ]
)

// ---------------------------------------------------------------------------
// Nodes  (visual shapes in a view)
// ---------------------------------------------------------------------------

export const nodes = pgTable(
  "nodes",
  {
    id: serial("id").primaryKey(),
    viewId: integer("view_id")
      .notNull()
      .references(() => views.id, { onDelete: "cascade" }),
    uuid: text("uuid").notNull(),
    name: text("name"),
    elementUuid: text("element_uuid"), // ref → elements.uuid (NULL for containers/labels)
    parentNodeUuid: text("parent_node_uuid"), // NULL = root node in view
    x: integer("x"),
    y: integer("y"),
    w: integer("w"),
    h: integer("h"),
    // Style — fill color
    fillColorR: integer("fill_color_r"),
    fillColorG: integer("fill_color_g"),
    fillColorB: integer("fill_color_b"),
    fillColorA: integer("fill_color_a"),
    // Style — line
    lineColorR: integer("line_color_r"),
    lineColorG: integer("line_color_g"),
    lineColorB: integer("line_color_b"),
    lineColorA: integer("line_color_a"),
    lineWidth: integer("line_width"),
    // Style — font
    fontName: text("font_name"),
    fontSize: real("font_size"),
    fontColorR: integer("font_color_r"),
    fontColorG: integer("font_color_g"),
    fontColorB: integer("font_color_b"),
    fontColorA: integer("font_color_a"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("nodes_uuid_view_uniq").on(t.viewId, t.uuid),
    index("nodes_view_idx").on(t.viewId),
    index("nodes_parent_idx").on(t.viewId, t.parentNodeUuid),
    index("nodes_element_idx").on(t.elementUuid),
  ]
)

// ---------------------------------------------------------------------------
// Connections  (visual connectors in a view)
// ---------------------------------------------------------------------------

export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    viewId: integer("view_id")
      .notNull()
      .references(() => views.id, { onDelete: "cascade" }),
    uuid: text("uuid").notNull(),
    name: text("name"),
    relationshipUuid: text("relationship_uuid"), // ref → relationships.uuid
    sourceNodeUuid: text("source_node_uuid"),
    targetNodeUuid: text("target_node_uuid"),
    // Style — line
    lineColorR: integer("line_color_r"),
    lineColorG: integer("line_color_g"),
    lineColorB: integer("line_color_b"),
    lineColorA: integer("line_color_a"),
    lineWidth: integer("line_width"),
    // Style — font
    fontName: text("font_name"),
    fontSize: real("font_size"),
    fontColorR: integer("font_color_r"),
    fontColorG: integer("font_color_g"),
    fontColorB: integer("font_color_b"),
    fontColorA: integer("font_color_a"),
  },
  (t) => [
    uniqueIndex("connections_uuid_view_uniq").on(t.viewId, t.uuid),
    index("connections_view_idx").on(t.viewId),
    index("connections_rel_idx").on(t.relationshipUuid),
  ]
)

// ---------------------------------------------------------------------------
// Bendpoints  (waypoints for connection routing)
// ---------------------------------------------------------------------------

export const bendpoints = pgTable(
  "bendpoints",
  {
    id: serial("id").primaryKey(),
    connectionId: integer("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("bendpoints_connection_idx").on(t.connectionId)]
)
