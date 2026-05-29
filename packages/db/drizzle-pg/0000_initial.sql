CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"          serial PRIMARY KEY,
  "uuid"        text NOT NULL,
  "name"        text NOT NULL,
  "description" text,
  "version"     text,
  "created_at"  integer NOT NULL DEFAULT extract(epoch from now())::int,
  "updated_at"  integer NOT NULL DEFAULT extract(epoch from now())::int
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_name_uniq" ON "workspaces" ("name");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "elements" (
  "id"           serial PRIMARY KEY,
  "workspace_id" integer NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "uuid"         text NOT NULL,
  "type"         text NOT NULL,
  "name"         text NOT NULL DEFAULT '',
  "description"  text
);
CREATE UNIQUE INDEX IF NOT EXISTS "elements_uuid_ws_uniq" ON "elements" ("workspace_id", "uuid");
CREATE INDEX IF NOT EXISTS "elements_workspace_idx" ON "elements" ("workspace_id");
CREATE INDEX IF NOT EXISTS "elements_type_idx" ON "elements" ("workspace_id", "type");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationships" (
  "id"                serial PRIMARY KEY,
  "workspace_id"      integer NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "uuid"              text NOT NULL,
  "type"              text NOT NULL,
  "name"              text,
  "description"       text,
  "source_uuid"       text NOT NULL,
  "target_uuid"       text NOT NULL,
  "access_type"       text,
  "is_directed"       boolean,
  "influence_modifier" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_uuid_ws_uniq" ON "relationships" ("workspace_id", "uuid");
CREATE INDEX IF NOT EXISTS "relationships_workspace_idx" ON "relationships" ("workspace_id");
CREATE INDEX IF NOT EXISTS "relationships_source_idx" ON "relationships" ("workspace_id", "source_uuid");
CREATE INDEX IF NOT EXISTS "relationships_target_idx" ON "relationships" ("workspace_id", "target_uuid");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_definitions" (
  "id"           serial PRIMARY KEY,
  "workspace_id" integer NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "uuid"         text NOT NULL,
  "name"         text NOT NULL,
  "type"         text NOT NULL DEFAULT 'string'
);
CREATE UNIQUE INDEX IF NOT EXISTS "prop_defs_uuid_ws_uniq" ON "property_definitions" ("workspace_id", "uuid");
CREATE INDEX IF NOT EXISTS "prop_defs_workspace_idx" ON "property_definitions" ("workspace_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "element_properties" (
  "id"               serial PRIMARY KEY,
  "element_id"       integer NOT NULL REFERENCES "elements"("id") ON DELETE CASCADE,
  "property_def_uuid" text NOT NULL,
  "value"            text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS "elem_props_element_idx" ON "element_properties" ("element_id");
CREATE INDEX IF NOT EXISTS "elem_props_def_idx" ON "element_properties" ("property_def_uuid");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_properties" (
  "id"               serial PRIMARY KEY,
  "relationship_id"  integer NOT NULL REFERENCES "relationships"("id") ON DELETE CASCADE,
  "property_def_uuid" text NOT NULL,
  "value"            text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS "rel_props_relationship_idx" ON "relationship_properties" ("relationship_id");
CREATE INDEX IF NOT EXISTS "rel_props_def_idx" ON "relationship_properties" ("property_def_uuid");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "views" (
  "id"           serial PRIMARY KEY,
  "workspace_id" integer NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "uuid"         text NOT NULL,
  "name"         text NOT NULL DEFAULT '',
  "description"  text,
  "viewpoint"    text
);
CREATE UNIQUE INDEX IF NOT EXISTS "views_uuid_ws_uniq" ON "views" ("workspace_id", "uuid");
CREATE INDEX IF NOT EXISTS "views_workspace_idx" ON "views" ("workspace_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nodes" (
  "id"               serial PRIMARY KEY,
  "view_id"          integer NOT NULL REFERENCES "views"("id") ON DELETE CASCADE,
  "uuid"             text NOT NULL,
  "name"             text,
  "element_uuid"     text,
  "parent_node_uuid" text,
  "x"                integer,
  "y"                integer,
  "w"                integer,
  "h"                integer,
  "fill_color_r"     integer,
  "fill_color_g"     integer,
  "fill_color_b"     integer,
  "fill_color_a"     integer,
  "line_color_r"     integer,
  "line_color_g"     integer,
  "line_color_b"     integer,
  "line_color_a"     integer,
  "line_width"       integer,
  "font_name"        text,
  "font_size"        real,
  "font_color_r"     integer,
  "font_color_g"     integer,
  "font_color_b"     integer,
  "font_color_a"     integer,
  "sort_order"       integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "nodes_uuid_view_uniq" ON "nodes" ("view_id", "uuid");
CREATE INDEX IF NOT EXISTS "nodes_view_idx" ON "nodes" ("view_id");
CREATE INDEX IF NOT EXISTS "nodes_parent_idx" ON "nodes" ("view_id", "parent_node_uuid");
CREATE INDEX IF NOT EXISTS "nodes_element_idx" ON "nodes" ("element_uuid");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
  "id"                serial PRIMARY KEY,
  "view_id"           integer NOT NULL REFERENCES "views"("id") ON DELETE CASCADE,
  "uuid"              text NOT NULL,
  "name"              text,
  "relationship_uuid" text,
  "source_node_uuid"  text,
  "target_node_uuid"  text,
  "line_color_r"      integer,
  "line_color_g"      integer,
  "line_color_b"      integer,
  "line_color_a"      integer,
  "line_width"        integer,
  "font_name"         text,
  "font_size"         real,
  "font_color_r"      integer,
  "font_color_g"      integer,
  "font_color_b"      integer,
  "font_color_a"      integer
);
CREATE UNIQUE INDEX IF NOT EXISTS "connections_uuid_view_uniq" ON "connections" ("view_id", "uuid");
CREATE INDEX IF NOT EXISTS "connections_view_idx" ON "connections" ("view_id");
CREATE INDEX IF NOT EXISTS "connections_rel_idx" ON "connections" ("relationship_uuid");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bendpoints" (
  "id"            serial PRIMARY KEY,
  "connection_id" integer NOT NULL REFERENCES "connections"("id") ON DELETE CASCADE,
  "x"             integer NOT NULL,
  "y"             integer NOT NULL,
  "sort_order"    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "bendpoints_connection_idx" ON "bendpoints" ("connection_id");

--> statement-breakpoint
-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id"               text PRIMARY KEY,
  "name"             text NOT NULL,
  "email"            text,
  "email_verified"   boolean NOT NULL DEFAULT false,
  "image"            text,
  "created_at"       timestamp NOT NULL,
  "updated_at"       timestamp NOT NULL,
  "username"         text NOT NULL,
  "display_username" text,
  "role"             text NOT NULL DEFAULT 'user',
  "banned"           boolean,
  "ban_reason"       text,
  "ban_expires"      integer
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_uniq" ON "user" ("username");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id"          text PRIMARY KEY,
  "user_id"     text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token"       text NOT NULL,
  "expires_at"  timestamp NOT NULL,
  "ip_address"  text,
  "user_agent"  text,
  "created_at"  timestamp NOT NULL,
  "updated_at"  timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_uniq" ON "session" ("token");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id"                      text PRIMARY KEY,
  "user_id"                 text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "account_id"              text NOT NULL,
  "provider_id"             text NOT NULL,
  "access_token"            text,
  "refresh_token"           text,
  "id_token"                text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope"                   text,
  "password"                text,
  "created_at"              timestamp NOT NULL,
  "updated_at"              timestamp NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id"         text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value"      text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);

--> statement-breakpoint
-- RBAC tables
CREATE TABLE IF NOT EXISTS "roles" (
  "id"          text PRIMARY KEY,
  "name"        text NOT NULL,
  "description" text,
  "is_system"   boolean NOT NULL DEFAULT false,
  "created_at"  integer NOT NULL DEFAULT extract(epoch from now())::int
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_uniq" ON "roles" ("name");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_layer_permissions" (
  "role_id"    text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "layer"      text NOT NULL,
  "permission" text NOT NULL DEFAULT '',
  PRIMARY KEY ("role_id", "layer")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "user_id")
);

--> statement-breakpoint
-- Drizzle migrations journal table (created by migrator, but idempotent here)
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  "id"         serial PRIMARY KEY,
  "hash"       text NOT NULL,
  "created_at" bigint
);
