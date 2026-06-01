CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bendpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"view_id" integer NOT NULL,
	"uuid" text NOT NULL,
	"name" text,
	"relationship_uuid" text,
	"source_node_uuid" text,
	"target_node_uuid" text,
	"line_color_r" integer,
	"line_color_g" integer,
	"line_color_b" integer,
	"line_color_a" integer,
	"line_width" integer,
	"font_name" text,
	"font_size" real,
	"font_color_r" integer,
	"font_color_g" integer,
	"font_color_b" integer,
	"font_color_a" integer
);
--> statement-breakpoint
CREATE TABLE "element_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"element_id" integer NOT NULL,
	"property_def_uuid" text NOT NULL,
	"value" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elements" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uuid" text NOT NULL,
	"type" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"view_id" integer NOT NULL,
	"uuid" text NOT NULL,
	"name" text,
	"element_uuid" text,
	"parent_node_uuid" text,
	"x" integer,
	"y" integer,
	"w" integer,
	"h" integer,
	"fill_color_r" integer,
	"fill_color_g" integer,
	"fill_color_b" integer,
	"fill_color_a" integer,
	"line_color_r" integer,
	"line_color_g" integer,
	"line_color_b" integer,
	"line_color_a" integer,
	"line_width" integer,
	"font_name" text,
	"font_size" real,
	"font_color_r" integer,
	"font_color_g" integer,
	"font_color_b" integer,
	"font_color_a" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"issuer_url" text,
	"tenant_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uuid" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'string' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"relationship_id" integer NOT NULL,
	"property_def_uuid" text NOT NULL,
	"value" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uuid" text NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"description" text,
	"source_uuid" text NOT NULL,
	"target_uuid" text NOT NULL,
	"access_type" text,
	"is_directed" boolean,
	"influence_modifier" text
);
--> statement-breakpoint
CREATE TABLE "role_layer_permissions" (
	"role_id" text NOT NULL,
	"layer" text NOT NULL,
	"permission" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "role_layer_permissions_role_id_layer_pk" PRIMARY KEY("role_id","layer")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"role_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "user_roles_role_id_user_id_pk" PRIMARY KEY("role_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"username" text NOT NULL,
	"display_username" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" integer
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"uuid" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text,
	"viewpoint" text
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bendpoints" ADD CONSTRAINT "bendpoints_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "element_properties" ADD CONSTRAINT "element_properties_element_id_elements_id_fk" FOREIGN KEY ("element_id") REFERENCES "public"."elements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elements" ADD CONSTRAINT "elements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_definitions" ADD CONSTRAINT "property_definitions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_properties" ADD CONSTRAINT "relationship_properties_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_layer_permissions" ADD CONSTRAINT "role_layer_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bendpoints_connection_idx" ON "bendpoints" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_uuid_view_uniq" ON "connections" USING btree ("view_id","uuid");--> statement-breakpoint
CREATE INDEX "connections_view_idx" ON "connections" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "connections_rel_idx" ON "connections" USING btree ("relationship_uuid");--> statement-breakpoint
CREATE INDEX "elem_props_element_idx" ON "element_properties" USING btree ("element_id");--> statement-breakpoint
CREATE INDEX "elem_props_def_idx" ON "element_properties" USING btree ("property_def_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "elements_uuid_ws_uniq" ON "elements" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "elements_workspace_idx" ON "elements" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "elements_type_idx" ON "elements" USING btree ("workspace_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_uuid_view_uniq" ON "nodes" USING btree ("view_id","uuid");--> statement-breakpoint
CREATE INDEX "nodes_view_idx" ON "nodes" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "nodes_parent_idx" ON "nodes" USING btree ("view_id","parent_node_uuid");--> statement-breakpoint
CREATE INDEX "nodes_element_idx" ON "nodes" USING btree ("element_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_providers_provider_id_uniq" ON "oauth_providers" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prop_defs_uuid_ws_uniq" ON "property_definitions" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "prop_defs_workspace_idx" ON "property_definitions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rel_props_relationship_idx" ON "relationship_properties" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "rel_props_def_idx" ON "relationship_properties" USING btree ("property_def_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_uuid_ws_uniq" ON "relationships" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "relationships_workspace_idx" ON "relationships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "relationships_source_idx" ON "relationships" USING btree ("workspace_id","source_uuid");--> statement-breakpoint
CREATE INDEX "relationships_target_idx" ON "relationships" USING btree ("workspace_id","target_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_uniq" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uniq" ON "session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_uniq" ON "user" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "views_uuid_ws_uniq" ON "views" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "views_workspace_idx" ON "views" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_name_uniq" ON "workspaces" USING btree ("name");