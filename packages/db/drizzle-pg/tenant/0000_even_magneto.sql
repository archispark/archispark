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
CREATE TABLE "user_active_workspace" (
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" integer NOT NULL,
	CONSTRAINT "user_active_workspace_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
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
CREATE TABLE "workspace_teams" (
	"workspace_id" integer NOT NULL,
	"team_id" text NOT NULL,
	CONSTRAINT "workspace_teams_workspace_id_team_id_pk" PRIMARY KEY("workspace_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text,
	"organization_id" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bendpoints" ADD CONSTRAINT "bendpoints_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "element_properties" ADD CONSTRAINT "element_properties_element_id_elements_id_fk" FOREIGN KEY ("element_id") REFERENCES "public"."elements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elements" ADD CONSTRAINT "elements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_definitions" ADD CONSTRAINT "property_definitions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_properties" ADD CONSTRAINT "relationship_properties_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_active_workspace" ADD CONSTRAINT "user_active_workspace_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_teams" ADD CONSTRAINT "workspace_teams_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "prop_defs_uuid_ws_uniq" ON "property_definitions" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "prop_defs_workspace_idx" ON "property_definitions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rel_props_relationship_idx" ON "relationship_properties" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "rel_props_def_idx" ON "relationship_properties" USING btree ("property_def_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_uuid_ws_uniq" ON "relationships" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "relationships_workspace_idx" ON "relationships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "relationships_source_idx" ON "relationships" USING btree ("workspace_id","source_uuid");--> statement-breakpoint
CREATE INDEX "relationships_target_idx" ON "relationships" USING btree ("workspace_id","target_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "views_uuid_ws_uniq" ON "views" USING btree ("workspace_id","uuid");--> statement-breakpoint
CREATE INDEX "views_workspace_idx" ON "views" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_teams_team_idx" ON "workspace_teams" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_org_name_uniq" ON "workspaces" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "workspaces_organization_idx" ON "workspaces" USING btree ("organization_id");